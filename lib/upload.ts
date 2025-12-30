import axios, { AxiosError } from "axios";
import FormData from "form-data";
import type { ReadStream } from "fs";

export interface WhatsAppUploadParams {
    version: string;                // e.g. "v19.0"
    phoneNumberId: string;
    file: Buffer | ReadStream;
    accessToken: string;
    fileName?: string;              // e.g. "image.jpg"
    mimeType?: string;              // e.g. "image/jpeg" (recommended)
}

export class WhatsAppUploadService {
    async uploadMedia(params: WhatsAppUploadParams): Promise<{ id: string }> {
        const { version, phoneNumberId, file, accessToken, fileName, mimeType } = params;

        const url = `https://graph.facebook.com/${version}/${phoneNumberId}/media`;

        const formData = new FormData();
        formData.append("messaging_product", "whatsapp");

        // WhatsApp examples often include "type" (MIME) alongside the file.
        if (mimeType) formData.append("type", mimeType);

        // Provide filename + contentType where possible
        formData.append(
            "file",
            file,
            mimeType ? { filename: fileName ?? "upload", contentType: mimeType } : (fileName ?? "upload")
        );

        try {
            const res = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${accessToken}`,
                    "User-Agent": "WhatsApp-Upload-Service/1.0",
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });

            return res.data as { id: string };
        } catch (e: unknown) {
            if (axios.isAxiosError(e)) {
                const data = e.response?.data;
                throw new Error(`WhatsApp upload failed: ${JSON.stringify(data ?? e.message)}`);
            }
            throw new Error(`WhatsApp upload failed: ${String(e)}`);
        }
    }
}
