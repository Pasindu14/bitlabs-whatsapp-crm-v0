'use client';

import { useQuery } from '@tanstack/react-query';
import { getWhatsappPhoneProfileAction } from '../actions/whatsapp-phone-profile.actions';
import { WHATSAPP_ACCOUNTS_KEY } from './use-whatsapp-accounts';
import type { WhatsappPhoneProfileResponse } from '../schemas/whatsapp-phone-profile.schema';

interface UseWhatsappPhoneProfileParams {
  phoneNumberId: string;
  includeId?: boolean;
  includeDisplayPhoneNumber?: boolean;
  includeVerifiedName?: boolean;
  includeQualityRating?: boolean;
  includeNameStatus?: boolean;
  includeCodeVerification?: boolean;
}

function buildFieldsParam(params: UseWhatsappPhoneProfileParams): string | undefined {
  const fields: string[] = [];
  
  if (params.includeId) fields.push('id');
  if (params.includeDisplayPhoneNumber) fields.push('display_phone_number');
  if (params.includeVerifiedName) fields.push('verified_name');
  if (params.includeQualityRating) fields.push('quality_rating');
  if (params.includeNameStatus) fields.push('name_status');
  if (params.includeCodeVerification) fields.push('code_verification_status');
  
  return fields.length > 0 ? fields.join(',') : undefined;
}

export function useWhatsappPhoneProfile(params: UseWhatsappPhoneProfileParams) {
  return useQuery({
    queryKey: [WHATSAPP_ACCOUNTS_KEY, 'profile', params.phoneNumberId, params.includeId, params.includeDisplayPhoneNumber, params.includeVerifiedName, params.includeQualityRating, params.includeNameStatus, params.includeCodeVerification],
    queryFn: async () => {
      const result = await getWhatsappPhoneProfileAction({
        phoneNumberId: params.phoneNumberId,
        fields: buildFieldsParam(params),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as WhatsappPhoneProfileResponse;
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });
}
