import { Result } from '@/lib/result';
import { createPerformanceLogger } from '@/lib/logger';
import axios from 'axios';
import type { WhatsappPhoneProfileResponse, WhatsappPhoneProfileQuery } from '../schemas/whatsapp-phone-profile.schema';

export class WhatsappPhoneProfileService {
  static async getProfile(input: WhatsappPhoneProfileQuery): Promise<Result<WhatsappPhoneProfileResponse>> {
    const perf = createPerformanceLogger('WhatsappPhoneProfileService.getProfile', {
      context: { phoneNumberId: input.phoneNumberId },
    });

    try {
      const fieldsParam = buildFieldsParam(input.fields);
      const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/whatsapp-accounts/phone-profile?phoneNumberId=${encodeURIComponent(input.phoneNumberId)}${fieldsParam}`;

      const response = await axios.get(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data) {
        perf.complete();
        return Result.ok(response.data as WhatsappPhoneProfileResponse, 'Profile loaded');
      } else {
        perf.fail('Failed to fetch profile');
        return Result.internal('WhatsApp API error, please try again');
      }
    } catch (error) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
      let errorMessage = 'Failed to fetch profile';

      if (axiosError.response) {
        const status = axiosError.response.status;
        if (status === 401) {
          errorMessage = 'WhatsApp API authentication failed';
        } else if (status === 403) {
          errorMessage = 'No permission to access phone number';
        } else if (status === 404) {
          errorMessage = 'Phone number not found';
        } else if (status === 429) {
          errorMessage = 'Rate limit exceeded, please retry later';
        } else {
          errorMessage = axiosError.response.data?.error || 'WhatsApp API error, please try again';
        }
      } else {
        errorMessage = axiosError.message || 'Network error';
      }

      perf.fail(errorMessage);
      return Result.internal(errorMessage);
    }
  }
}

function buildFieldsParam(fields?: string): string {
  if (!fields) return '';
  return `&fields=${encodeURIComponent(fields)}`;
}
