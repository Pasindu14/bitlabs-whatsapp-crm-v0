"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ResetPasswordDialogProps {
  open: boolean;
  loading?: boolean;
  userName?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ResetPasswordDialog({
  open,
  loading,
  userName,
  onClose,
  onConfirm,
}: ResetPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Resetting..." : "Reset password"}
          </Button>
          <DialogDescription>
            {userName ? `${userName}'s` : "This user's"} password will be reset to a new temporary password. Continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
