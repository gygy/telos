import type { ReactEventHandler, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { t, type Locale } from "../lib/i18n.ts";
import { cn } from "../lib/utils.ts";

export function ContentPreviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  className?: string | undefined;
  testId?: string | undefined;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "content-preview-dialog top-0 left-0 max-w-none translate-x-0 translate-y-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-none",
          props.className,
        )}
        aria-label={props.title}
        data-testid={props.testId}
      >
        <DialogTitle className="sr-only">{props.title}</DialogTitle>
        <DialogClose asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon-lg"
            className="content-preview-dialog-close"
            aria-label={props.closeLabel}
            title={props.closeLabel}
          >
            <X />
          </Button>
        </DialogClose>
        {props.children}
      </DialogContent>
    </Dialog>
  );
}

export function ImagePreviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: string;
  alt?: string | undefined;
  locale: Locale;
  onError?: ReactEventHandler<HTMLImageElement> | undefined;
}) {
  const title = props.alt || t(props.locale, "timeline.imagePreview");
  return (
    <ContentPreviewDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      closeLabel={t(props.locale, "timeline.imagePreviewClose")}
      className="content-image-preview-dialog"
      testId="image-preview-dialog"
    >
      <div className="content-image-preview-surface">
        <img
          src={props.source}
          alt={props.alt ?? ""}
          className="content-image-preview-image"
          onError={props.onError}
        />
      </div>
    </ContentPreviewDialog>
  );
}
