import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, key: file.key, name: file.name, size: file.size, type: file.type };
    }),
  audioUploader: f({ audio: { maxFileSize: "16MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, key: file.key, name: file.name, size: file.size, type: file.type };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
