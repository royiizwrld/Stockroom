import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DemoUpgradeDialog({ open, onOpenChange, action }: { open: boolean; onOpenChange: (v: boolean) => void; action?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a free account to {action ?? "do this"}</DialogTitle>
          <DialogDescription>
            You're exploring a sample workspace as a guest. Changes stay in this browser tab only. Create an account to keep your own inventory, invite your team and manage workspace settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep exploring</Button>
          <Button asChild><Link to="/signup">Create account</Link></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
