// src/pages/UserDashboard/components/EditAlbumModal.types.ts
import type { IAlbums } from '@models';

export interface EditAlbumModalProps {
  isOpen: boolean;
  albumId?: string;
  onClose: () => void;
  onNext?: (data: AlbumFormData, updatedAlbum?: IAlbums) => void;
}

export interface BandMember {
  name: string;
  role: string;
  url?: string;
}

export interface RecordingEntry {
  text: string; // Полный текст записи (например, "SEP. 28, 2021: Igor Matvienko's recording studio M.A.M.A, Big studio, Moscow.")
  url?: string;
}

export interface ProducingCredits {
  [creditType: string]: BandMember[];
}

export interface StreamingLink {
  service: string;
  url: string;
}

export interface AlbumFormData {
  artist: string;
  title: string;
  releaseDate: string;
  upcEan: string;
  albumArt: File | null;
  description: string;
  visibleOnAlbumPage: boolean;
  allowDownloadSale: 'no' | 'yes' | 'preorder';
  regularPrice: string;
  currency: string;
  preorderReleaseDate: string;
  mood: string[];
  tags: string[];
  albumCoverPhotographer: string;
  albumCoverPhotographerURL: string;
  albumCoverDesigner: string;
  albumCoverDesignerURL: string;
  bandMembers: BandMember[];
  showAddBandMemberInputs?: boolean; // Показывать поля для добавления нового участника
  sessionMusicians: BandMember[];
  showAddSessionMusicianInputs?: boolean; // Показывать поля для добавления нового музыканта
  producer: RecordingEntry[];
  producerText?: string; // Временное поле для ввода текста
  producerURL?: string; // Временное поле для ввода URL
  editingProducerIndex?: number | null; // Индекс редактируемой записи
  showAddProducerInputs?: boolean; // Показывать поля для добавления новой записи
  mastering: RecordingEntry[];
  masteringText?: string; // Временное поле для ввода текста
  masteringURL?: string; // Временное поле для ввода URL
  editingMasteringIndex?: number | null; // Индекс редактируемой записи
  showAddMasteringInputs?: boolean; // Показывать поля для добавления новой записи
  producingCredits: ProducingCredits; // Оставляем для обратной совместимости, но больше не используем
  recordedAt: RecordingEntry[];
  recordedAtText?: string; // Временное поле для ввода текста
  recordedAtURL?: string; // Временное поле для ввода URL
  editingRecordedAtIndex?: number | null; // Индекс редактируемой записи
  showAddRecordedAtInputs?: boolean; // Показывать поля для добавления новой записи
  mixedAt: RecordingEntry[];
  mixedAtText?: string; // Временное поле для ввода текста
  mixedAtURL?: string; // Временное поле для ввода URL
  editingMixedAtIndex?: number | null; // Индекс редактируемой записи
  showAddMixedAtInputs?: boolean; // Показывать поля для добавления новой записи
  purchaseLinks: StreamingLink[];
  streamingLinks: StreamingLink[];
}
