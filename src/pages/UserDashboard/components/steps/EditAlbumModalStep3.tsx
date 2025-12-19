// src/pages/UserDashboard/components/steps/EditAlbumModalStep3.tsx
import React from 'react';
import type { AlbumFormData } from '../EditAlbumModal.types';
import { MAX_BAND_MEMBERS, DEFAULT_PRODUCING_CREDIT_TYPES } from '../EditAlbumModal.constants';

interface EditAlbumModalStep3Props {
  formData: AlbumFormData;
  bandMemberName: string;
  bandMemberRole: string;
  editingBandMemberIndex: number | null;
  sessionMusicianName: string;
  sessionMusicianRole: string;
  editingSessionMusicianIndex: number | null;
  producingNames: Record<string, string>;
  producingRoles: Record<string, string>;
  editingProducingCredit: { creditType: string; nameIndex: number } | null;
  newCreditType: string;
  onFormDataChange: (field: keyof AlbumFormData, value: string | boolean | File | null) => void;
  onBandMemberNameChange: (value: string) => void;
  onBandMemberRoleChange: (value: string) => void;
  onAddBandMember: () => void;
  onEditBandMember: (index: number) => void;
  onRemoveBandMember: (index: number) => void;
  onCancelEditBandMember: () => void;
  onSessionMusicianNameChange: (value: string) => void;
  onSessionMusicianRoleChange: (value: string) => void;
  onAddSessionMusician: () => void;
  onEditSessionMusician: (index: number) => void;
  onRemoveSessionMusician: (index: number) => void;
  onCancelEditSessionMusician: () => void;
  onProducingNameChange: (creditType: string, value: string) => void;
  onProducingRoleChange: (creditType: string, value: string) => void;
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
  editingBandMemberIndex,
  sessionMusicianName,
  sessionMusicianRole,
  editingSessionMusicianIndex,
  producingNames,
  producingRoles,
  editingProducingCredit,
  newCreditType,
  onFormDataChange,
  onBandMemberNameChange,
  onBandMemberRoleChange,
  onAddBandMember,
  onEditBandMember,
  onRemoveBandMember,
  onCancelEditBandMember,
  onSessionMusicianNameChange,
  onSessionMusicianRoleChange,
  onAddSessionMusician,
  onEditSessionMusician,
  onRemoveSessionMusician,
  onCancelEditSessionMusician,
  onProducingNameChange,
  onProducingRoleChange,
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
          <input
            name="album-cover-photographer"
            type="text"
            autoComplete="name"
            className="edit-album-modal__input"
            placeholder="Photographer"
            required
            value={formData.albumCoverPhotographer}
            onChange={(e) => onFormDataChange('albumCoverPhotographer', e.target.value)}
          />
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
        </div>
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Band Members</label>

        {formData.bandMembers.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.bandMembers.map((member, index) => (
              <div key={index} className="edit-album-modal__list-item">
                <div className="edit-album-modal__list-item-content">
                  <span className="edit-album-modal__list-item-name">{member.name}</span>
                  <span className="edit-album-modal__list-item-role">{member.role}</span>
                </div>
                <div className="edit-album-modal__list-item-actions">
                  <button
                    type="button"
                    className="edit-album-modal__list-item-edit"
                    onClick={() => onEditBandMember(index)}
                    aria-label={`Edit ${member.name}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="edit-album-modal__list-item-remove"
                    onClick={() => onRemoveBandMember(index)}
                    aria-label={`Remove ${member.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
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

            <div className="edit-album-modal__add-button-group">
              <button
                type="button"
                className="edit-album-modal__add-button"
                onClick={onAddBandMember}
                disabled={!bandMemberName.trim() || !bandMemberRole.trim()}
              >
                {editingBandMemberIndex !== null ? 'Save' : '+ Add member'}
              </button>

              {editingBandMemberIndex !== null && (
                <button
                  type="button"
                  className="edit-album-modal__cancel-button"
                  onClick={onCancelEditBandMember}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">Session Musicians</label>

        {formData.sessionMusicians.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.sessionMusicians.map((musician, index) => (
              <div key={index} className="edit-album-modal__list-item">
                <div className="edit-album-modal__list-item-content">
                  <span className="edit-album-modal__list-item-name">{musician.name}</span>
                  <span className="edit-album-modal__list-item-role">{musician.role}</span>
                </div>
                <div className="edit-album-modal__list-item-actions">
                  <button
                    type="button"
                    className="edit-album-modal__list-item-edit"
                    onClick={() => onEditSessionMusician(index)}
                    aria-label={`Edit ${musician.name}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="edit-album-modal__list-item-remove"
                    onClick={() => onRemoveSessionMusician(index)}
                    aria-label={`Remove ${musician.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
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

            <div className="edit-album-modal__add-button-group">
              <button
                type="button"
                className="edit-album-modal__add-button"
                onClick={onAddSessionMusician}
                disabled={!sessionMusicianName.trim() || !sessionMusicianRole.trim()}
              >
                {editingSessionMusicianIndex !== null ? 'Save' : '+ Add musician'}
              </button>

              {editingSessionMusicianIndex !== null && (
                <button
                  type="button"
                  className="edit-album-modal__cancel-button"
                  onClick={onCancelEditSessionMusician}
                >
                  Cancel
                </button>
              )}
            </div>
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
                  {members.map((member, memberIndex) => (
                    <div key={memberIndex} className="edit-album-modal__list-item">
                      <div className="edit-album-modal__list-item-content">
                        <span className="edit-album-modal__list-item-name">{member.name}</span>
                        {member.role && (
                          <span className="edit-album-modal__list-item-role">{member.role}</span>
                        )}
                      </div>
                      <div className="edit-album-modal__list-item-actions">
                        <button
                          type="button"
                          className="edit-album-modal__list-item-edit"
                          onClick={() => onEditProducingCredit(creditType, memberIndex)}
                          aria-label={`Edit ${member.name}`}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="edit-album-modal__list-item-remove"
                          onClick={() => onRemoveProducingCredit(creditType, memberIndex)}
                          aria-label={`Remove ${member.name}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isEditing ? (
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
                        if (e.key === 'Escape') onCancelEditProducingCredit();
                      }}
                      autoFocus
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
                        if (e.key === 'Escape') onCancelEditProducingCredit();
                      }}
                    />
                  </div>

                  <div className="edit-album-modal__add-button-group">
                    <button
                      type="button"
                      className="edit-album-modal__add-button"
                      onClick={() => onAddProducingCredit(creditType)}
                      disabled={!producingNames[creditType]?.trim()}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="edit-album-modal__cancel-button"
                      onClick={onCancelEditProducingCredit}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
                    {members.map((member, memberIndex) => (
                      <div key={memberIndex} className="edit-album-modal__list-item">
                        <div className="edit-album-modal__list-item-content">
                          <span className="edit-album-modal__list-item-name">{member.name}</span>
                          {member.role && (
                            <span className="edit-album-modal__list-item-role">{member.role}</span>
                          )}
                        </div>
                        <div className="edit-album-modal__list-item-actions">
                          <button
                            type="button"
                            className="edit-album-modal__list-item-edit"
                            onClick={() => onEditProducingCredit(creditType, memberIndex)}
                            aria-label={`Edit ${member.name}`}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="edit-album-modal__list-item-remove"
                            onClick={() => onRemoveProducingCredit(creditType, memberIndex)}
                            aria-label={`Remove ${member.name}`}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isEditing ? (
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
                          if (e.key === 'Escape') onCancelEditProducingCredit();
                        }}
                        autoFocus
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
                          if (e.key === 'Escape') onCancelEditProducingCredit();
                        }}
                      />
                    </div>

                    <div className="edit-album-modal__add-button-group">
                      <button
                        type="button"
                        className="edit-album-modal__add-button"
                        onClick={() => onAddProducingCredit(creditType)}
                        disabled={!producingNames[creditType]?.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="edit-album-modal__cancel-button"
                        onClick={onCancelEditProducingCredit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
