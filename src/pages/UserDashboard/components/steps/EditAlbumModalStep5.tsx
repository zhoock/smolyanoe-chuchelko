// src/pages/UserDashboard/components/steps/EditAlbumModalStep5.tsx
import React from 'react';
import type { AlbumFormData } from '../EditAlbumModal.types';
import type { IInterface } from '@models';
import { PURCHASE_SERVICES, STREAMING_SERVICES } from '../EditAlbumModal.constants';

interface EditAlbumModalStep5Props {
  formData: AlbumFormData;
  editingPurchaseLink: number | null;
  purchaseLinkService: string;
  purchaseLinkUrl: string;
  editingStreamingLink: number | null;
  streamingLinkService: string;
  streamingLinkUrl: string;
  onPurchaseLinkServiceChange: (value: string) => void;
  onPurchaseLinkUrlChange: (value: string) => void;
  onAddPurchaseLink: () => void;
  onEditPurchaseLink: (index: number) => void;
  onRemovePurchaseLink: (index: number) => void;
  onCancelEditPurchaseLink: () => void;
  onStreamingLinkServiceChange: (value: string) => void;
  onStreamingLinkUrlChange: (value: string) => void;
  onAddStreamingLink: () => void;
  onEditStreamingLink: (index: number) => void;
  onRemoveStreamingLink: (index: number) => void;
  onCancelEditStreamingLink: () => void;
  ui?: IInterface;
}

export function EditAlbumModalStep5({
  formData,
  editingPurchaseLink,
  purchaseLinkService,
  purchaseLinkUrl,
  editingStreamingLink,
  streamingLinkService,
  streamingLinkUrl,
  onPurchaseLinkServiceChange,
  onPurchaseLinkUrlChange,
  onAddPurchaseLink,
  onEditPurchaseLink,
  onRemovePurchaseLink,
  onCancelEditPurchaseLink,
  onStreamingLinkServiceChange,
  onStreamingLinkUrlChange,
  onAddStreamingLink,
  onEditStreamingLink,
  onRemoveStreamingLink,
  onCancelEditStreamingLink,
  ui,
}: EditAlbumModalStep5Props) {
  return (
    <>
      <div className="edit-album-modal__divider" />

      <div className="edit-album-modal__links-container">
        <div className="edit-album-modal__links-column">
          <label className="edit-album-modal__links-label">
            {ui?.dashboard?.editAlbumModal?.step5?.purchase ?? 'Purchase'}
          </label>

          <div className="edit-album-modal__links-list">
            {formData.purchaseLinks.map((link, index) => {
              const service = PURCHASE_SERVICES.find((s) => s.id === link.service);
              const isEditing = editingPurchaseLink === index;

              return (
                <div key={index} className="edit-album-modal__link-item">
                  {isEditing ? (
                    <div className="edit-album-modal__link-edit">
                      <select
                        name="purchase-link-service"
                        autoComplete="off"
                        className="edit-album-modal__link-select"
                        value={purchaseLinkService}
                        onChange={(e) => onPurchaseLinkServiceChange(e.target.value)}
                      >
                        <option value="">
                          {ui?.dashboard?.editAlbumModal?.step5?.selectService ?? 'Select service'}
                        </option>
                        {PURCHASE_SERVICES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      <input
                        name="purchase-link-url"
                        type="url"
                        autoComplete="url"
                        className="edit-album-modal__link-input"
                        placeholder={ui?.dashboard?.editAlbumModal?.step5?.url ?? 'URL'}
                        value={purchaseLinkUrl}
                        onChange={(e) => onPurchaseLinkUrlChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            purchaseLinkService.trim() &&
                            purchaseLinkUrl.trim()
                          ) {
                            e.preventDefault();
                            onAddPurchaseLink();
                          }
                          if (e.key === 'Escape') onCancelEditPurchaseLink();
                        }}
                        autoFocus
                      />

                      <div className="edit-album-modal__link-actions">
                        <button
                          type="button"
                          className="edit-album-modal__link-save"
                          onClick={onAddPurchaseLink}
                          disabled={!purchaseLinkService.trim() || !purchaseLinkUrl.trim()}
                        >
                          {ui?.dashboard?.editAlbumModal?.step5?.save ?? 'Save'}
                        </button>
                        <button
                          type="button"
                          className="edit-album-modal__link-cancel"
                          onClick={onCancelEditPurchaseLink}
                        >
                          {ui?.dashboard?.editAlbumModal?.step5?.cancel ?? 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="edit-album-modal__link-content">
                        {service && (
                          <span className={`edit-album-modal__link-icon ${service.icon}`} />
                        )}
                        <span className="edit-album-modal__link-name">
                          {service ? service.name : link.service}
                        </span>
                      </div>
                      <div className="edit-album-modal__link-item-actions">
                        <button
                          type="button"
                          className="edit-album-modal__list-item-edit"
                          onClick={() => onEditPurchaseLink(index)}
                          aria-label={`Edit ${service ? service.name : link.service}`}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="edit-album-modal__list-item-remove"
                          onClick={() => onRemovePurchaseLink(index)}
                          aria-label={`Remove ${service ? service.name : link.service}`}
                        >
                          ×
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {editingPurchaseLink === null && (
            <div className="edit-album-modal__link-add">
              <select
                name="purchase-link-service"
                autoComplete="off"
                className="edit-album-modal__link-select"
                value={purchaseLinkService}
                onChange={(e) => onPurchaseLinkServiceChange(e.target.value)}
              >
                <option value="">
                  {ui?.dashboard?.editAlbumModal?.step5?.selectService ?? 'Select service'}
                </option>
                {PURCHASE_SERVICES.filter(
                  (s) => !formData.purchaseLinks.some((l) => l.service === s.id)
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <input
                name="purchase-link-url"
                type="url"
                autoComplete="url"
                className="edit-album-modal__link-input"
                placeholder="URL"
                value={purchaseLinkUrl}
                onChange={(e) => onPurchaseLinkUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && purchaseLinkService.trim() && purchaseLinkUrl.trim()) {
                    e.preventDefault();
                    onAddPurchaseLink();
                  }
                }}
              />

              <button
                type="button"
                className="edit-album-modal__add-button"
                onClick={onAddPurchaseLink}
                disabled={!purchaseLinkService.trim() || !purchaseLinkUrl.trim()}
              >
                + Add
              </button>
            </div>
          )}
        </div>

        <div className="edit-album-modal__links-column">
          <label className="edit-album-modal__links-label">
            {ui?.dashboard?.editAlbumModal?.step5?.streaming ?? 'Streaming'}
          </label>

          <div className="edit-album-modal__links-list">
            {formData.streamingLinks.map((link, index) => {
              const service = STREAMING_SERVICES.find((s) => s.id === link.service);
              const isEditing = editingStreamingLink === index;

              return (
                <div key={index} className="edit-album-modal__link-item">
                  {isEditing ? (
                    <div className="edit-album-modal__link-edit">
                      <select
                        name="streaming-link-service"
                        autoComplete="off"
                        className="edit-album-modal__link-select"
                        value={streamingLinkService}
                        onChange={(e) => onStreamingLinkServiceChange(e.target.value)}
                      >
                        <option value="">
                          {ui?.dashboard?.editAlbumModal?.step5?.selectService ?? 'Select service'}
                        </option>
                        {STREAMING_SERVICES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      <input
                        name="streaming-link-url"
                        type="url"
                        autoComplete="url"
                        className="edit-album-modal__link-input"
                        placeholder={ui?.dashboard?.editAlbumModal?.step5?.url ?? 'URL'}
                        value={streamingLinkUrl}
                        onChange={(e) => onStreamingLinkUrlChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            streamingLinkService.trim() &&
                            streamingLinkUrl.trim()
                          ) {
                            e.preventDefault();
                            onAddStreamingLink();
                          }
                          if (e.key === 'Escape') onCancelEditStreamingLink();
                        }}
                        autoFocus
                      />

                      <div className="edit-album-modal__link-actions">
                        <button
                          type="button"
                          className="edit-album-modal__link-save"
                          onClick={onAddStreamingLink}
                          disabled={!streamingLinkService.trim() || !streamingLinkUrl.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="edit-album-modal__link-cancel"
                          onClick={onCancelEditStreamingLink}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="edit-album-modal__link-content">
                        {service && (
                          <span className={`edit-album-modal__link-icon ${service.icon}`} />
                        )}
                        <span className="edit-album-modal__link-name">
                          {service ? service.name : link.service}
                        </span>
                      </div>
                      <div className="edit-album-modal__link-item-actions">
                        <button
                          type="button"
                          className="edit-album-modal__list-item-edit"
                          onClick={() => onEditStreamingLink(index)}
                          aria-label={`Edit ${service ? service.name : link.service}`}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="edit-album-modal__list-item-remove"
                          onClick={() => onRemoveStreamingLink(index)}
                          aria-label={`Remove ${service ? service.name : link.service}`}
                        >
                          ×
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {editingStreamingLink === null && (
            <div className="edit-album-modal__link-add">
              <select
                name="streaming-link-service"
                autoComplete="off"
                className="edit-album-modal__link-select"
                value={streamingLinkService}
                onChange={(e) => onStreamingLinkServiceChange(e.target.value)}
              >
                <option value="">
                  {ui?.dashboard?.editAlbumModal?.step5?.selectService ?? 'Select service'}
                </option>
                {STREAMING_SERVICES.filter(
                  (s) => !formData.streamingLinks.some((l) => l.service === s.id)
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <input
                name="streaming-link-url"
                type="url"
                autoComplete="url"
                className="edit-album-modal__link-input"
                placeholder="URL"
                value={streamingLinkUrl}
                onChange={(e) => onStreamingLinkUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && streamingLinkService.trim() && streamingLinkUrl.trim()) {
                    e.preventDefault();
                    onAddStreamingLink();
                  }
                }}
              />

              <button
                type="button"
                className="edit-album-modal__add-button"
                onClick={onAddStreamingLink}
                disabled={!streamingLinkService.trim() || !streamingLinkUrl.trim()}
              >
                + Add
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
