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
  purchaseLinks: StreamingLink[];
  streamingLinks: StreamingLink[];
}
