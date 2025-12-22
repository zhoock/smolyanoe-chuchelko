// src/pages/UserDashboard/components/steps/EditAlbumModalStep4.tsx
import React from 'react';
import type { AlbumFormData } from '../EditAlbumModal.types';
import type { IInterface } from '@models';
import { MAX_BAND_MEMBERS } from '../EditAlbumModal.constants';
import { EditableCardField } from '../shared/EditableCardField';
import '../shared/EditableCardField.style.scss';

interface EditAlbumModalStep4Props {
  formData: AlbumFormData;
  bandMemberName: string;
  bandMemberRole: string;
  bandMemberURL: string;
  editingBandMemberIndex: number | null;
  sessionMusicianName: string;
  sessionMusicianRole: string;
  sessionMusicianURL: string;
  editingSessionMusicianIndex: number | null;
  onFormDataChange: (field: keyof AlbumFormData, value: any) => void;
  onBandMemberNameChange: (value: string) => void;
  onBandMemberRoleChange: (value: string) => void;
  onBandMemberURLChange: (value: string) => void;
  onAddBandMember: () => void;
  onEditBandMember: (index: number) => void;
  onRemoveBandMember: (index: number) => void;
  onCancelEditBandMember: () => void;
  onSessionMusicianNameChange: (value: string) => void;
  onSessionMusicianRoleChange: (value: string) => void;
  onSessionMusicianURLChange: (value: string) => void;
  onAddSessionMusician: () => void;
  onEditSessionMusician: (index: number) => void;
  onRemoveSessionMusician: (index: number) => void;
  onCancelEditSessionMusician: () => void;
  ui?: IInterface;
}

export function EditAlbumModalStep4({
  formData,
  bandMemberName,
  bandMemberRole,
  bandMemberURL,
  editingBandMemberIndex,
  sessionMusicianName,
  sessionMusicianRole,
  sessionMusicianURL,
  editingSessionMusicianIndex,
  onFormDataChange,
  onBandMemberNameChange,
  onBandMemberRoleChange,
  onBandMemberURLChange,
  onAddBandMember,
  onEditBandMember,
  onRemoveBandMember,
  onCancelEditBandMember,
  onSessionMusicianNameChange,
  onSessionMusicianRoleChange,
  onSessionMusicianURLChange,
  onAddSessionMusician,
  onEditSessionMusician,
  onRemoveSessionMusician,
  onCancelEditSessionMusician,
  ui,
}: EditAlbumModalStep4Props) {
  return (
    <>
      <div className="edit-album-modal__divider" />

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step4?.albumCover ?? 'Album Cover'}
        </label>
        <div className="edit-album-modal__two-column-inputs">
          <div>
            <input
              name="album-cover-photographer"
              type="text"
              autoComplete="name"
              className="edit-album-modal__input"
              placeholder={
                ui?.dashboard?.editAlbumModal?.step4?.photographer ?? 'Photographer (optional)'
              }
              value={formData.albumCoverPhotographer}
              onChange={(e) => onFormDataChange('albumCoverPhotographer', e.target.value)}
            />
            <input
              name="album-cover-photographer-url"
              type="url"
              autoComplete="url"
              className="edit-album-modal__input"
              placeholder={
                ui?.dashboard?.editAlbumModal?.step4?.photographerUrl ??
                'Photographer URL (optional)'
              }
              value={formData.albumCoverPhotographerURL}
              onChange={(e) => onFormDataChange('albumCoverPhotographerURL', e.target.value)}
            />
          </div>
          <div>
            <input
              name="album-cover-designer"
              type="text"
              autoComplete="name"
              className="edit-album-modal__input"
              placeholder={ui?.dashboard?.editAlbumModal?.step4?.designer ?? 'Designer'}
              required
              value={formData.albumCoverDesigner}
              onChange={(e) => onFormDataChange('albumCoverDesigner', e.target.value)}
            />
            <input
              name="album-cover-designer-url"
              type="url"
              autoComplete="url"
              className="edit-album-modal__input"
              placeholder={
                ui?.dashboard?.editAlbumModal?.step4?.designerUrl ?? 'Designer URL (optional)'
              }
              value={formData.albumCoverDesignerURL}
              onChange={(e) => onFormDataChange('albumCoverDesignerURL', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step4?.bandMembers ?? 'Band Members'}
        </label>

        {formData.bandMembers.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.bandMembers.map((member, index) => (
              <EditableCardField
                key={index}
                data={{
                  title: member.name,
                  description: member.role,
                  url: member.url,
                }}
                isEditing={editingBandMemberIndex === index}
                editTitle={bandMemberName}
                editDescription={bandMemberRole}
                editUrl={bandMemberURL}
                onTitleChange={onBandMemberNameChange}
                onDescriptionChange={onBandMemberRoleChange}
                onUrlChange={onBandMemberURLChange}
                onEdit={() => onEditBandMember(index)}
                onSave={onAddBandMember}
                onCancel={onCancelEditBandMember}
                onRemove={() => onRemoveBandMember(index)}
                titlePlaceholder="Name"
                descriptionPlaceholder="Role"
                urlPlaceholder="URL (optional)"
                ui={ui}
              />
            ))}
          </div>
        )}

        {formData.bandMembers.length >= MAX_BAND_MEMBERS && (
          <div className="edit-album-modal__help-text">
            Maximum {MAX_BAND_MEMBERS} band members reached
          </div>
        )}

        {(formData.bandMembers.length === 0 || formData.showAddBandMemberInputs === true) &&
          formData.bandMembers.length < MAX_BAND_MEMBERS &&
          !editingBandMemberIndex && (
            <>
              <div className="edit-album-modal__two-column-inputs">
                <input
                  name="band-member-name"
                  type="text"
                  autoComplete="name"
                  className="edit-album-modal__input"
                  placeholder={ui?.dashboard?.editAlbumModal?.step4?.name ?? 'Name'}
                  value={bandMemberName}
                  onChange={(e) => onBandMemberNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                      e.preventDefault();
                      onAddBandMember();
                    }
                    if (e.key === 'Escape') {
                      onCancelEditBandMember();
                    }
                  }}
                />
                <input
                  name="band-member-role"
                  type="text"
                  autoComplete="organization-title"
                  className="edit-album-modal__input"
                  placeholder={ui?.dashboard?.editAlbumModal?.step4?.role ?? 'Role'}
                  value={bandMemberRole}
                  onChange={(e) => onBandMemberRoleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                      e.preventDefault();
                      onAddBandMember();
                    }
                    if (e.key === 'Escape') {
                      onCancelEditBandMember();
                    }
                  }}
                />
              </div>
              <input
                name="band-member-url"
                type="url"
                autoComplete="url"
                className="edit-album-modal__input"
                placeholder="URL (optional)"
                value={bandMemberURL}
                onChange={(e) => onBandMemberURLChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                    e.preventDefault();
                    onAddBandMember();
                  }
                  if (e.key === 'Escape') {
                    onCancelEditBandMember();
                  }
                }}
              />
              {bandMemberName.trim() && bandMemberRole.trim() && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={onAddBandMember}
                >
                  {ui?.dashboard?.editAlbumModal?.step4?.addButton ?? '+ Add'}
                </button>
              )}
            </>
          )}

        {formData.bandMembers.length > 0 &&
          formData.showAddBandMemberInputs !== true &&
          formData.bandMembers.length < MAX_BAND_MEMBERS &&
          !editingBandMemberIndex && (
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={() => onFormDataChange('showAddBandMemberInputs', true)}
            >
              {ui?.dashboard?.editAlbumModal?.step4?.addButton ?? '+ Add'}
            </button>
          )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step4?.sessionMusicians ?? 'Session Musicians'}
        </label>

        {formData.sessionMusicians.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.sessionMusicians.map((musician, index) => (
              <EditableCardField
                key={index}
                data={{
                  title: musician.name,
                  description: musician.role,
                  url: musician.url,
                }}
                isEditing={editingSessionMusicianIndex === index}
                editTitle={sessionMusicianName}
                editDescription={sessionMusicianRole}
                editUrl={sessionMusicianURL}
                onTitleChange={onSessionMusicianNameChange}
                onDescriptionChange={onSessionMusicianRoleChange}
                onUrlChange={onSessionMusicianURLChange}
                onEdit={() => onEditSessionMusician(index)}
                onSave={onAddSessionMusician}
                onCancel={onCancelEditSessionMusician}
                onRemove={() => onRemoveSessionMusician(index)}
                titlePlaceholder="Name"
                descriptionPlaceholder="Role"
                urlPlaceholder="URL (optional)"
                ui={ui}
              />
            ))}
          </div>
        )}

        {formData.sessionMusicians.length >= MAX_BAND_MEMBERS && (
          <div className="edit-album-modal__help-text">
            Maximum {MAX_BAND_MEMBERS} session musicians reached
          </div>
        )}

        {(formData.sessionMusicians.length === 0 ||
          formData.showAddSessionMusicianInputs === true) &&
          formData.sessionMusicians.length < MAX_BAND_MEMBERS &&
          !editingSessionMusicianIndex && (
            <>
              <div className="edit-album-modal__two-column-inputs">
                <input
                  name="session-musician-name"
                  type="text"
                  autoComplete="name"
                  className="edit-album-modal__input"
                  placeholder={ui?.dashboard?.editAlbumModal?.step4?.name ?? 'Name'}
                  value={sessionMusicianName}
                  onChange={(e) => onSessionMusicianNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      sessionMusicianName.trim() &&
                      sessionMusicianRole.trim()
                    ) {
                      e.preventDefault();
                      onAddSessionMusician();
                    }
                    if (e.key === 'Escape') {
                      onCancelEditSessionMusician();
                    }
                  }}
                />
                <input
                  name="session-musician-role"
                  type="text"
                  autoComplete="organization-title"
                  className="edit-album-modal__input"
                  placeholder={ui?.dashboard?.editAlbumModal?.step4?.role ?? 'Role'}
                  value={sessionMusicianRole}
                  onChange={(e) => onSessionMusicianRoleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      sessionMusicianName.trim() &&
                      sessionMusicianRole.trim()
                    ) {
                      e.preventDefault();
                      onAddSessionMusician();
                    }
                    if (e.key === 'Escape') {
                      onCancelEditSessionMusician();
                    }
                  }}
                />
              </div>
              <input
                name="session-musician-url"
                type="url"
                autoComplete="url"
                className="edit-album-modal__input"
                placeholder="URL (optional)"
                value={sessionMusicianURL}
                onChange={(e) => onSessionMusicianURLChange(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    sessionMusicianName.trim() &&
                    sessionMusicianRole.trim()
                  ) {
                    e.preventDefault();
                    onAddSessionMusician();
                  }
                  if (e.key === 'Escape') {
                    onCancelEditSessionMusician();
                  }
                }}
              />
              {sessionMusicianName.trim() && sessionMusicianRole.trim() && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={onAddSessionMusician}
                >
                  {ui?.dashboard?.editAlbumModal?.step4?.addButton ?? '+ Add'}
                </button>
              )}
            </>
          )}

        {formData.sessionMusicians.length > 0 &&
          formData.showAddSessionMusicianInputs !== true &&
          formData.sessionMusicians.length < MAX_BAND_MEMBERS &&
          !editingSessionMusicianIndex && (
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={() => onFormDataChange('showAddSessionMusicianInputs', true)}
            >
              {ui?.dashboard?.editAlbumModal?.step4?.addButton ?? '+ Add'}
            </button>
          )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step4?.producer ?? 'Producer'}
        </label>

        {formData.producer.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.producer.map((entry, index) => {
              const isEditing = formData.editingProducerIndex === index;
              return (
                <EditableCardField
                  key={index}
                  data={{
                    title: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  editTitle={formData.producerText || ''}
                  editDescription=""
                  editUrl={formData.producerURL || ''}
                  onTitleChange={(value) => onFormDataChange('producerText', value)}
                  onDescriptionChange={() => {}}
                  onUrlChange={(value) => onFormDataChange('producerURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingProducerIndex', index);
                    onFormDataChange('producerText', entry.text);
                    onFormDataChange('producerURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.producer];
                    updated[index] = {
                      text: formData.producerText!.trim(),
                      url: formData.producerURL?.trim() || undefined,
                    };
                    onFormDataChange('producer', updated);
                    onFormDataChange('producerText', '');
                    onFormDataChange('producerURL', '');
                    onFormDataChange('editingProducerIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('producerText', '');
                    onFormDataChange('producerURL', '');
                    onFormDataChange('editingProducerIndex', null);
                    onFormDataChange('showAddProducerInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.producer];
                    updated.splice(index, 1);
                    onFormDataChange('producer', updated);
                  }}
                  titlePlaceholder="Producer info (e.g., Yaroslav Zhuk — producer.)"
                  descriptionPlaceholder=""
                  urlPlaceholder="URL (optional)"
                  ui={ui}
                />
              );
            })}
          </div>
        )}

        {(formData.producer.length === 0 || formData.showAddProducerInputs === true) &&
          !formData.editingProducerIndex && (
            <>
              <div className="edit-album-modal__two-column-inputs">
                <input
                  name="producer-text"
                  type="text"
                  className="edit-album-modal__input"
                  placeholder="Producer info (e.g., Yaroslav Zhuk — producer.)"
                  value={formData.producerText || ''}
                  onChange={(e) => onFormDataChange('producerText', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.producerText?.trim()) {
                      e.preventDefault();
                      const text = formData.producerText.trim();
                      const url = formData.producerURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('producer', [...formData.producer, newEntry]);
                      onFormDataChange('producerText', '');
                      onFormDataChange('producerURL', '');
                      onFormDataChange('showAddProducerInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('producerText', '');
                      onFormDataChange('producerURL', '');
                      onFormDataChange('showAddProducerInputs', false);
                    }
                  }}
                />
                <input
                  name="producer-url"
                  type="url"
                  autoComplete="url"
                  className="edit-album-modal__input"
                  placeholder={
                    ui?.dashboard?.editAlbumModal?.step4?.urlOptional ?? 'URL (optional)'
                  }
                  value={formData.producerURL || ''}
                  onChange={(e) => onFormDataChange('producerURL', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.producerText?.trim()) {
                      e.preventDefault();
                      const text = formData.producerText.trim();
                      const url = formData.producerURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('producer', [...formData.producer, newEntry]);
                      onFormDataChange('producerText', '');
                      onFormDataChange('producerURL', '');
                      onFormDataChange('showAddProducerInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('producerText', '');
                      onFormDataChange('producerURL', '');
                      onFormDataChange('showAddProducerInputs', false);
                    }
                  }}
                />
              </div>
              {formData.producerText?.trim() && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = formData.producerText!.trim();
                    const url = formData.producerURL?.trim() || undefined;
                    const newEntry = { text, url };
                    onFormDataChange('producer', [...formData.producer, newEntry]);
                    onFormDataChange('producerText', '');
                    onFormDataChange('producerURL', '');
                    onFormDataChange('showAddProducerInputs', false);
                  }}
                >
                  {ui?.dashboard?.editAlbumModal?.step4?.addButton ?? '+ Add'}
                </button>
              )}
            </>
          )}

        {formData.producer &&
          formData.producer.length > 0 &&
          formData.showAddProducerInputs !== true &&
          !formData.editingProducerIndex && (
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={() => onFormDataChange('showAddProducerInputs', true)}
            >
              {ui?.dashboard?.editAlbumModal?.step4?.addButton ?? '+ Add'}
            </button>
          )}
      </div>
    </>
  );
}
