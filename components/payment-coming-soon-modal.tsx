"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentComingSoonModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-semibold">
            Payment Coming Soon
          </DialogTitle>
        </DialogHeader>
        <div className="text-center space-y-3 text-sm text-muted-foreground leading-relaxed pt-1 pb-2">
          <p>
            We&apos;re currently setting up our payment system.
            <br />
            We&apos;ll notify you as soon as it&apos;s ready!
          </p>
          <p>
            In the meantime, if you&apos;d like full access now,
            <br />
            contact us at{" "}
            <a
              href="mailto:support@unfoldk.com"
              className="text-foreground font-medium underline underline-offset-2 hover:opacity-80"
            >
              support@unfoldk.com
            </a>
            {" "}and we&apos;ll activate your membership manually. 🎉
          </p>
        </div>
        <Button
          className="w-full rounded-full font-medium text-white mt-1"
          style={{ backgroundColor: "#FF4B6E" }}
          onClick={() => onOpenChange(false)}
        >
          Got it!
        </Button>
      </DialogContent>
    </Dialog>
  )
}
