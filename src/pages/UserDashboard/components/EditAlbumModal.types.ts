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
  sessionMusicians: BandMember[];
  producingCredits: ProducingCredits;
  recordedAt: RecordingEntry[];
  recordedAtText?: string; // Временное поле для ввода текста
  recordedAtURL?: string; // Временное поле для ввода URL
  editingRecordedAtIndex?: number | null; // Индекс редактируемой записи
  mixedAt: RecordingEntry[];
  mixedAtText?: string; // Временное поле для ввода текста
  mixedAtURL?: string; // Временное поле для ввода URL
  editingMixedAtIndex?: number | null; // Индекс редактируемой записи
  purchaseLinks: StreamingLink[];
  streamingLinks: StreamingLink[];
}
