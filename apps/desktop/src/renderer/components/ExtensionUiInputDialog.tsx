/**
 * Extension UI `input` / `editor` free-text dialog.
 * Electron disables `window.prompt`; empty submit is allowed (RPC multi-select).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ExtensionUiInputDialog(props: {
  open: boolean;
  title: string;
  initialValue: string;
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  testId?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(props.initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!props.open) return;
    settledRef.current = false;
    setValue(props.initialValue);
    const id = window.setTimeout(() => {
      const el = props.multiline ? textareaRef.current : inputRef.current;
      el?.focus();
      el?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [props.open, props.initialValue, props.multiline]);

  function submit() {
    settledRef.current = true;
    props.onConfirm(value);
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (open) {
          settledRef.current = false;
          return;
        }
        if (!settledRef.current) props.onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={props.multiline ? "max-w-lg gap-3 p-4" : "max-w-sm gap-3 p-4"}
        data-testid={props.testId ?? "extension-ui-input-dialog"}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold whitespace-pre-wrap">
            {props.title}
          </DialogTitle>
        </DialogHeader>
        {props.multiline ? (
          <Textarea
            ref={textareaRef}
            data-testid="extension-ui-input-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            className="min-h-[160px] resize-y text-[13px]"
          />
        ) : (
          <Input
            ref={inputRef}
            data-testid="extension-ui-input-field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="h-9 text-[13px]"
          />
        )}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="extension-ui-input-cancel"
            onClick={() => {
              settledRef.current = true;
              props.onCancel();
            }}
          >
            {props.cancelLabel ?? "Cancel"}
          </Button>
          <Button type="button" size="sm" data-testid="extension-ui-input-confirm" onClick={submit}>
            {props.confirmLabel ?? "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
