// src/pages/UserDashboard/components/blocks/BlockCarousel.tsx
import React, { useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getUserImageUrl } from '@shared/api/albums';
import { uploadFile } from '@shared/api/storage';
import { CURRENT_USER_CONFIG } from '@config/user';

interface BlockCarouselProps {
  imageKeys: string[];
  caption?: string;
  onChange: (imageKeys: string[], caption?: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onDelete?: () => void;
}

export function BlockCarousel({
  imageKeys,
  caption,
  onChange,
  onFocus,
  onBlur,
  onDelete,
}: BlockCarouselProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [captionValue, setCaptionValue] = useState(caption || '');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const newImageKeys: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const baseFileName = file.name.replace(/\.[^/.]+$/, '');
        // Уникальный timestamp для каждого файла
        const timestamp = Date.now() + i;
        const fileName = `article_${timestamp}_${baseFileName}.${fileExtension}`;
        const imageKey = `article_${timestamp}_${baseFileName}`;
        
        const url = await uploadFile({
          userId: CURRENT_USER_CONFIG.userId,
          file,
          category: 'articles',
          fileName,
        });

        if (url) {
          newImageKeys.push(imageKey);
        }
      }
      onChange([...imageKeys, ...newImageKeys], captionValue || undefined);
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImageKeys = imageKeys.filter((_, i) => i !== index);
    onChange(newImageKeys, captionValue || undefined);
  };

  // Sensors для drag-and-drop внутри карусели
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Обработчик drag-and-drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = imageKeys.findIndex((key) => key === active.id);
      const newIndex = imageKeys.findIndex((key) => key === over.id);

      const newImageKeys = arrayMove(imageKeys, oldIndex, newIndex);
      onChange(newImageKeys, captionValue || undefined);
    }
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value;
    setCaptionValue(newCaption);
    onChange(imageKeys, newCaption || undefined);
  };

  return (
    <div
      className="edit-article-v2__block edit-article-v2__block--carousel"
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    >
      <div className="uncollapse edit-article-v2__carousel-container">
        {imageKeys.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={imageKeys}
              strategy={horizontalListSortingStrategy}
            >
              <div className="edit-article-v2__carousel-images">
                {imageKeys.map((imageKey) => (
                  <SortableCarouselImage
                    key={imageKey}
                    imageKey={imageKey}
                    onRemove={() => {
                      const index = imageKeys.findIndex((key) => key === imageKey);
                      handleRemoveImage(index);
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}
        <button
          type="button"
          className="edit-article-v2__carousel-add"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Загрузка...' : '+ Добавить изображение'}
        </button>
        {onDelete && imageKeys.length > 0 && (
          <button
            type="button"
            className="edit-article-v2__carousel-delete"
            onClick={onDelete}
          >
            Удалить карусель
          </button>
        )}
      </div>
      {imageKeys.length > 0 && (
        <input
          type="text"
          className="edit-article-v2__carousel-caption"
          value={captionValue}
          onChange={handleCaptionChange}
          placeholder="Подпись к карусели (необязательно)"
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
}

interface SortableCarouselImageProps {
  imageKey: string;
  onRemove: () => void;
}

function SortableCarouselImage({ imageKey, onRemove }: SortableCarouselImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: imageKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const imageUrl = getUserImageUrl(imageKey, 'articles');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="edit-article-v2__carousel-image-item"
    >
      <div
        className="edit-article-v2__carousel-image-drag-handle"
        {...attributes}
        {...listeners}
      >
        <img src={imageUrl} alt={`Image`} />
      </div>
      <button
        type="button"
        className="edit-article-v2__carousel-remove"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

