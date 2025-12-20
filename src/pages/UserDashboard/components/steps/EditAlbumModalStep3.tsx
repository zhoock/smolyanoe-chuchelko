// src/pages/UserDashboard/components/steps/EditAlbumModalStep3.tsx
import React from 'react';
import type { AlbumFormData } from '../EditAlbumModal.types';
import { MAX_BAND_MEMBERS, DEFAULT_PRODUCING_CREDIT_TYPES } from '../EditAlbumModal.constants';
import { EditableCardField } from '../shared/EditableCardField';
import '../shared/EditableCardField.style.scss';

interface EditAlbumModalStep3Props {
  formData: AlbumFormData;
  bandMemberName: string;
  bandMemberRole: string;
  bandMemberURL: string;
  editingBandMemberIndex: number | null;
  sessionMusicianName: string;
  sessionMusicianRole: string;
  sessionMusicianURL: string;
  editingSessionMusicianIndex: number | null;
  producingNames: Record<string, string>;
  producingRoles: Record<string, string>;
  producingURLs: Record<string, string>;
  editingProducingCredit: { creditType: string; nameIndex: number } | null;
  newCreditType: string;
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
  onProducingNameChange: (creditType: string, value: string) => void;
  onProducingRoleChange: (creditType: string, value: string) => void;
  onProducingURLChange: (creditType: string, value: string) => void;
  onAddProducingCredit: (creditType: string) => void;
  onEditProducingCredit: (creditType: string, nameIndex: number) => void;
  onRemoveProducingCredit: (creditType: string, nameIndex: number) => void;
  onCancelEditProducingCredit: () => void;
  onNewCreditTypeChange: (value: string) => void;
  onAddNewCreditType: () => void;
  onRemoveCreditType: (creditType: string) => void;
}

export function EditAlbumModalStep3({
  formData,
  bandMemberName,
  bandMemberRole,
  bandMemberURL,
  editingBandMemberIndex,
  sessionMusicianName,
  sessionMusicianRole,
  sessionMusicianURL,
  editingSessionMusicianIndex,
  producingNames,
  producingRoles,
  producingURLs,
  editingProducingCredit,
  newCreditType,
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
  onProducingNameChange,
  onProducingRoleChange,
  onProducingURLChange,
  onAddProducingCredit,
  onEditProducingCredit,
  onRemoveProducingCredit,
  onCancelEditProducingCredit,
  onNewCreditTypeChange,
  onAddNewCreditType,
  onRemoveCreditType,
}: EditAlbumModalStep3Props) {
  return (
    <>
      <div className="edit-album-modal__divider" />

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Album Cover</label>
        <div className="edit-album-modal__two-column-inputs">
          <div>
            <input
              name="album-cover-photographer"
              type="text"
              autoComplete="name"
              className="edit-album-modal__input"
              placeholder="Photographer (optional)"
              value={formData.albumCoverPhotographer}
              onChange={(e) => onFormDataChange('albumCoverPhotographer', e.target.value)}
            />
            <input
              name="album-cover-photographer-url"
              type="url"
              autoComplete="url"
              className="edit-album-modal__input"
              placeholder="Photographer URL (optional)"
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
              placeholder="Designer"
              required
              value={formData.albumCoverDesigner}
              onChange={(e) => onFormDataChange('albumCoverDesigner', e.target.value)}
            />
            <input
              name="album-cover-designer-url"
              type="url"
              autoComplete="url"
              className="edit-album-modal__input"
              placeholder="Designer URL (optional)"
              value={formData.albumCoverDesignerURL}
              onChange={(e) => onFormDataChange('albumCoverDesignerURL', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Recorded At</label>

        {formData.recordedAt.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.recordedAt.map((entry, index) => {
              const isEditing = formData.editingRecordedAtIndex === index;
              return (
                <EditableCardField
                  key={index}
                  data={{
                    title: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  editTitle={formData.recordedAtText || ''}
                  editDescription=""
                  editUrl={formData.recordedAtURL || ''}
                  onTitleChange={(value) => onFormDataChange('recordedAtText', value)}
                  onDescriptionChange={() => {}}
                  onUrlChange={(value) => onFormDataChange('recordedAtURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingRecordedAtIndex', index);
                    onFormDataChange('recordedAtText', entry.text);
                    onFormDataChange('recordedAtURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.recordedAt];
                    updated[index] = {
                      text: formData.recordedAtText!.trim(),
                      url: formData.recordedAtURL?.trim() || undefined,
                    };
                    onFormDataChange('recordedAt', updated);
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('editingRecordedAtIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('editingRecordedAtIndex', null);
                  }}
                  onRemove={() => {
                    const updated = [...formData.recordedAt];
                    updated.splice(index, 1);
                    onFormDataChange('recordedAt', updated);
                  }}
                  titlePlaceholder="Recording info (e.g., SEP. 28, 2021: Studio Name, Location.)"
                  descriptionPlaceholder=""
                  urlPlaceholder="URL (optional)"
                  showCancel={true}
                />
              );
            })}
          </div>
        )}

        <div className="edit-album-modal__two-column-inputs">
          <input
            name="recorded-at-text"
            type="text"
            className="edit-album-modal__input"
            placeholder="Recording info (e.g., SEP. 28, 2021: Studio Name, Location.)"
            value={formData.recordedAtText || ''}
            onChange={(e) => onFormDataChange('recordedAtText', e.target.value)}
          />
          <input
            name="recorded-at-url"
            type="url"
            autoComplete="url"
            className="edit-album-modal__input"
            placeholder="URL (optional)"
            value={formData.recordedAtURL || ''}
            onChange={(e) => onFormDataChange('recordedAtURL', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && formData.recordedAtText?.trim()) {
                e.preventDefault();
                const text = formData.recordedAtText.trim();
                const url = formData.recordedAtURL?.trim() || undefined;
                const newEntry = { text, url };
                onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                onFormDataChange('recordedAtText', '');
                onFormDataChange('recordedAtURL', '');
              }
            }}
          />
        </div>
        {formData.recordedAtText?.trim() && (
          <button
            type="button"
            className="edit-album-modal__add-button"
            onClick={() => {
              const text = formData.recordedAtText!.trim();
              const url = formData.recordedAtURL?.trim() || undefined;
              const newEntry = { text, url };
              onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
              onFormDataChange('recordedAtText', '');
              onFormDataChange('recordedAtURL', '');
            }}
          >
            + Add
          </button>
        )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Mixed At</label>

        {formData.mixedAt.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.mixedAt.map((entry, index) => {
              const isEditing = formData.editingMixedAtIndex === index;
              return (
                <EditableCardField
                  key={index}
                  data={{
                    title: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  editTitle={formData.mixedAtText || ''}
                  editDescription=""
                  editUrl={formData.mixedAtURL || ''}
                  onTitleChange={(value) => onFormDataChange('mixedAtText', value)}
                  onDescriptionChange={() => {}}
                  onUrlChange={(value) => onFormDataChange('mixedAtURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingMixedAtIndex', index);
                    onFormDataChange('mixedAtText', entry.text);
                    onFormDataChange('mixedAtURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.mixedAt];
                    updated[index] = {
                      text: formData.mixedAtText!.trim(),
                      url: formData.mixedAtURL?.trim() || undefined,
                    };
                    onFormDataChange('mixedAt', updated);
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('editingMixedAtIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('editingMixedAtIndex', null);
                  }}
                  onRemove={() => {
                    const updated = [...formData.mixedAt];
                    updated.splice(index, 1);
                    onFormDataChange('mixedAt', updated);
                  }}
                  titlePlaceholder="Mixing info (e.g., JAN. 14, 2024—SEP. 22, 2024: Studio Name, Location.)"
                  descriptionPlaceholder=""
                  urlPlaceholder="URL (optional)"
                  showCancel={true}
                />
              );
            })}
          </div>
        )}

        <div className="edit-album-modal__two-column-inputs">
          <input
            name="mixed-at-text"
            type="text"
            className="edit-album-modal__input"
            placeholder="Mixing info (e.g., JAN. 14, 2024—SEP. 22, 2024: Studio Name, Location.)"
            value={formData.mixedAtText || ''}
            onChange={(e) => onFormDataChange('mixedAtText', e.target.value)}
          />
          <input
            name="mixed-at-url"
            type="url"
            autoComplete="url"
            className="edit-album-modal__input"
            placeholder="URL (optional)"
            value={formData.mixedAtURL || ''}
            onChange={(e) => onFormDataChange('mixedAtURL', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && formData.mixedAtText?.trim()) {
                e.preventDefault();
                const text = formData.mixedAtText.trim();
                const url = formData.mixedAtURL?.trim() || undefined;
                const newEntry = { text, url };
                onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                onFormDataChange('mixedAtText', '');
                onFormDataChange('mixedAtURL', '');
              }
            }}
          />
        </div>
        {formData.mixedAtText?.trim() && (
          <button
            type="button"
            className="edit-album-modal__add-button"
            onClick={() => {
              const text = formData.mixedAtText!.trim();
              const url = formData.mixedAtURL?.trim() || undefined;
              const newEntry = { text, url };
              onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
              onFormDataChange('mixedAtText', '');
              onFormDataChange('mixedAtURL', '');
            }}
          >
            + Add
          </button>
        )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Band Members</label>

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
              />
            ))}
          </div>
        )}

        {formData.bandMembers.length >= MAX_BAND_MEMBERS && (
          <div className="edit-album-modal__help-text">
            Maximum {MAX_BAND_MEMBERS} band members reached
          </div>
        )}

        {formData.bandMembers.length < MAX_BAND_MEMBERS && (
          <>
            <div className="edit-album-modal__two-column-inputs">
              <input
                name="band-member-name"
                type="text"
                autoComplete="name"
                className="edit-album-modal__input"
                placeholder="Name"
                value={bandMemberName}
                onChange={(e) => onBandMemberNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                    e.preventDefault();
                    onAddBandMember();
                  }
                  if (e.key === 'Escape' && editingBandMemberIndex !== null) {
                    onCancelEditBandMember();
                  }
                }}
              />
              <input
                name="band-member-role"
                type="text"
                autoComplete="organization-title"
                className="edit-album-modal__input"
                placeholder="Role"
                value={bandMemberRole}
                onChange={(e) => onBandMemberRoleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                    e.preventDefault();
                    onAddBandMember();
                  }
                  if (e.key === 'Escape' && editingBandMemberIndex !== null) {
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
                if (e.key === 'Escape' && editingBandMemberIndex !== null) {
                  onCancelEditBandMember();
                }
              }}
            />
          </>
        )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Session Musicians</label>

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
              />
            ))}
          </div>
        )}

        {formData.sessionMusicians.length >= MAX_BAND_MEMBERS && (
          <div className="edit-album-modal__help-text">
            Maximum {MAX_BAND_MEMBERS} session musicians reached
          </div>
        )}

        {formData.sessionMusicians.length < MAX_BAND_MEMBERS && (
          <>
            <div className="edit-album-modal__two-column-inputs">
              <input
                name="session-musician-name"
                type="text"
                autoComplete="name"
                className="edit-album-modal__input"
                placeholder="Name"
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
                  if (e.key === 'Escape' && editingSessionMusicianIndex !== null) {
                    onCancelEditSessionMusician();
                  }
                }}
              />
              <input
                name="session-musician-role"
                type="text"
                autoComplete="organization-title"
                className="edit-album-modal__input"
                placeholder="Role"
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
                  if (e.key === 'Escape' && editingSessionMusicianIndex !== null) {
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
                if (e.key === 'Enter' && sessionMusicianName.trim() && sessionMusicianRole.trim()) {
                  e.preventDefault();
                  onAddSessionMusician();
                }
                if (e.key === 'Escape' && editingSessionMusicianIndex !== null) {
                  onCancelEditSessionMusician();
                }
              }}
            />
          </>
        )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Producing</label>

        {DEFAULT_PRODUCING_CREDIT_TYPES.map((creditType) => {
          const members = formData.producingCredits[creditType] || [];
          const isEditing = editingProducingCredit?.creditType === creditType;

          return (
            <div key={creditType} className="edit-album-modal__producing-type-section">
              <div className="edit-album-modal__producing-type-header">
                <label className="edit-album-modal__producing-type-label">{creditType}</label>
              </div>

              {members.length > 0 && (
                <div className="edit-album-modal__list">
                  {members.map((member, memberIndex) => {
                    const isEditing =
                      editingProducingCredit?.creditType === creditType &&
                      editingProducingCredit?.nameIndex === memberIndex;
                    return (
                      <EditableCardField
                        key={memberIndex}
                        data={{
                          title: member.name,
                          description: member.role,
                          url: member.url,
                        }}
                        isEditing={isEditing}
                        editTitle={producingNames[creditType] || ''}
                        editDescription={producingRoles[creditType] || ''}
                        editUrl={producingURLs[creditType] || ''}
                        onTitleChange={(value) => onProducingNameChange(creditType, value)}
                        onDescriptionChange={(value) => onProducingRoleChange(creditType, value)}
                        onUrlChange={(value) => onProducingURLChange(creditType, value)}
                        onEdit={() => onEditProducingCredit(creditType, memberIndex)}
                        onSave={() => onAddProducingCredit(creditType)}
                        onCancel={onCancelEditProducingCredit}
                        onRemove={() => onRemoveProducingCredit(creditType, memberIndex)}
                        titlePlaceholder="Name"
                        descriptionPlaceholder="Role"
                        urlPlaceholder="URL (optional)"
                      />
                    );
                  })}
                </div>
              )}

              {!isEditing && (
                <div className="edit-album-modal__producing-input-group">
                  <div className="edit-album-modal__two-column-inputs">
                    <input
                      name={`producing-${creditType}-name`}
                      type="text"
                      autoComplete="name"
                      className="edit-album-modal__input"
                      placeholder="Name"
                      value={producingNames[creditType] || ''}
                      onChange={(e) => onProducingNameChange(creditType, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                          e.preventDefault();
                          onAddProducingCredit(creditType);
                        }
                      }}
                    />
                    <input
                      name={`producing-${creditType}-role`}
                      type="text"
                      autoComplete="organization-title"
                      className="edit-album-modal__input"
                      placeholder="Role"
                      value={producingRoles[creditType] || ''}
                      onChange={(e) => onProducingRoleChange(creditType, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                          e.preventDefault();
                          onAddProducingCredit(creditType);
                        }
                      }}
                    />
                  </div>
                  <input
                    name={`producing-${creditType}-url`}
                    type="url"
                    autoComplete="url"
                    className="edit-album-modal__input"
                    placeholder="URL (optional)"
                    value={producingURLs[creditType] || ''}
                    onChange={(e) => onProducingURLChange(creditType, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                        e.preventDefault();
                        onAddProducingCredit(creditType);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(formData.producingCredits)
          .filter((type) => !DEFAULT_PRODUCING_CREDIT_TYPES.includes(type))
          .map((creditType) => {
            const members = formData.producingCredits[creditType] || [];
            const isEditing = editingProducingCredit?.creditType === creditType;

            return (
              <div key={creditType} className="edit-album-modal__producing-type-section">
                <div className="edit-album-modal__producing-type-header">
                  <label className="edit-album-modal__producing-type-label">{creditType}</label>
                  <button
                    type="button"
                    className="edit-album-modal__remove-type-button"
                    onClick={() => onRemoveCreditType(creditType)}
                    aria-label={`Remove ${creditType} type`}
                  >
                    ×
                  </button>
                </div>

                {members.length > 0 && (
                  <div className="edit-album-modal__list">
                    {members.map((member, memberIndex) => {
                      const isEditingMember =
                        editingProducingCredit?.creditType === creditType &&
                        editingProducingCredit?.nameIndex === memberIndex;
                      return (
                        <EditableCardField
                          key={memberIndex}
                          data={{
                            title: member.name,
                            description: member.role,
                            url: member.url,
                          }}
                          isEditing={isEditingMember}
                          editTitle={producingNames[creditType] || ''}
                          editDescription={producingRoles[creditType] || ''}
                          editUrl={producingURLs[creditType] || ''}
                          onTitleChange={(value) => onProducingNameChange(creditType, value)}
                          onDescriptionChange={(value) => onProducingRoleChange(creditType, value)}
                          onUrlChange={(value) => onProducingURLChange(creditType, value)}
                          onEdit={() => onEditProducingCredit(creditType, memberIndex)}
                          onSave={() => onAddProducingCredit(creditType)}
                          onCancel={onCancelEditProducingCredit}
                          onRemove={() => onRemoveProducingCredit(creditType, memberIndex)}
                          titlePlaceholder="Name"
                          descriptionPlaceholder="Role"
                          urlPlaceholder="URL (optional)"
                        />
                      );
                    })}
                  </div>
                )}

                {!isEditing && (
                  <div className="edit-album-modal__producing-input-group">
                    <div className="edit-album-modal__two-column-inputs">
                      <input
                        name={`producing-${creditType}-name`}
                        type="text"
                        autoComplete="name"
                        className="edit-album-modal__input"
                        placeholder="Name"
                        value={producingNames[creditType] || ''}
                        onChange={(e) => onProducingNameChange(creditType, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                            e.preventDefault();
                            onAddProducingCredit(creditType);
                          }
                        }}
                      />
                      <input
                        name={`producing-${creditType}-role`}
                        type="text"
                        autoComplete="organization-title"
                        className="edit-album-modal__input"
                        placeholder="Role"
                        value={producingRoles[creditType] || ''}
                        onChange={(e) => onProducingRoleChange(creditType, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                            e.preventDefault();
                            onAddProducingCredit(creditType);
                          }
                        }}
                      />
                    </div>
                    <input
                      name={`producing-${creditType}-url`}
                      type="url"
                      autoComplete="url"
                      className="edit-album-modal__input"
                      placeholder="URL (optional)"
                      value={producingURLs[creditType] || ''}
                      onChange={(e) => onProducingURLChange(creditType, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                          e.preventDefault();
                          onAddProducingCredit(creditType);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="edit-album-modal__add-button"
                      onClick={() => onAddProducingCredit(creditType)}
                      disabled={!producingNames[creditType]?.trim()}
                    >
                      + Add
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        <div className="edit-album-modal__producing-new-type">
          <div className="edit-album-modal__producing-input-group">
            <input
              name="new-credit-type"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input"
              placeholder="New credit type"
              value={newCreditType}
              onChange={(e) => onNewCreditTypeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCreditType.trim()) {
                  e.preventDefault();
                  onAddNewCreditType();
                }
              }}
            />
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={onAddNewCreditType}
              disabled={!newCreditType.trim()}
            >
              + Add type
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
