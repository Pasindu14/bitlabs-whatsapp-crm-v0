'use client';

import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor';
import { cn } from '@/lib/utils';

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
  className?: string;
}

export function NoteEditor({ content, onChange, editable = true, className }: NoteEditorProps) {
  if (!editable) {
    return (
      <div className={cn('prose prose-sm max-w-none', className)} dangerouslySetInnerHTML={{ __html: content }} />
    );
  }

  return (
    <div className={cn('border rounded-md', className)}>
      <SimpleEditor content={content} onChange={onChange} fitContainer />
    </div>
  );
}
