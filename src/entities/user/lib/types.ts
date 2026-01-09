export interface PublicProfileData {
  userId: string;
  username: string;
  siteName?: string | null;
  role?: string;
  musicianStatus?: string;
  musicianRejectReason?: string | null;
  musicianAppliedAt?: string | null;
  musicianApprovedAt?: string | null;
  artistName?: string | null;
  bio?: string | null;
  links?: string[];
  theBand?: string[];
  headerImages?: string[];
}
