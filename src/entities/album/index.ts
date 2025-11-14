export { default as AlbumCover } from './ui/AlbumCover';
export { default as WrapperAlbumCover } from './ui/WrapperAlbumCover';
export { default as AlbumDetails } from './ui/AlbumDetails/AlbumDetails';

export { albumsReducer, fetchAlbums } from './model/albumsSlice';
export {
  selectAlbumsState,
  selectAlbumsEntry,
  selectAlbumsStatus,
  selectAlbumsError,
  selectAlbumsData,
  selectAlbumById,
} from './model/selectors';
export type { AlbumsState, AlbumsEntry, RequestStatus } from './model/types';
