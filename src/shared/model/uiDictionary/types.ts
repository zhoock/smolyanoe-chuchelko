import type { IInterface } from '@models';
import type { SupportedLang } from '@shared/model/lang';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface UiDictionaryEntry {
  status: RequestStatus;
  error: string | null;
  data: IInterface[];
  lastUpdated: number | null;
}

export type UiDictionaryState = Record<SupportedLang, UiDictionaryEntry>;
