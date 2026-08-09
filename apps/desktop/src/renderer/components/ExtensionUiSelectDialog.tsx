/**
 * Extension UI `select` — searchable option list.
 * Electron disables `window.prompt`; options must be real clickable choices
 * (ADR-008 / ui-spec §14: searchable Dialog/Command list).
 */
import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ExtensionUiSelectDialog(props: {
  open: boolean;
  title: string;
  options: string[];
  cancelLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  testId?: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const settledRef = useRef(false);

  useEffect(() => {
    if (!props.open) return;
    settledRef.current = false;
    setQuery("");
  }, [props.open, props.title, props.options]);

  function settleSelect(value: string) {
    settledRef.current = true;
    props.onSelect(value);
  }

  function settleCancel() {
    settledRef.current = true;
    props.onCancel();
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (open) {
          settledRef.current = false;
          return;
        }
        if (!settledRef.current) settleCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid={props.testId ?? "extension-ui-select-dialog"}
        className={cn(
          "top-1/2 left-1/2 z-[11000] w-[min(520px,92vw)] max-w-[calc(100%-2rem)]",
          "translate-x-[-50%] translate-y-[-50%] gap-0 overflow-hidden p-0",
          "rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-panel)]",
          "text-[var(--foreground)] shadow-[var(--shadow-soft)]",
          "duration-150 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100",
          "[&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-[var(--border)]",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1 border-b border-[var(--border)] px-4 py-3 text-left">
          <DialogTitle
            className="max-h-[min(200px,30vh)] overflow-y-auto text-[15px] leading-snug font-semibold whitespace-pre-wrap"
            data-testid="extension-ui-select-title"
          >
            {props.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {props.options.length > 0
              ? `Choose one of ${props.options.length} options`
              : "No options available"}
          </DialogDescription>
        </DialogHeader>

        <Command
          shouldFilter
          className="rounded-none border-0 bg-transparent shadow-none"
          label={props.title}
        >
          <CommandInput
            autoFocus
            data-testid="extension-ui-select-search"
            placeholder={props.searchPlaceholder ?? "Filter options…"}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList
            className="max-h-[min(360px,50vh)]"
            data-testid="extension-ui-select-options"
          >
            <CommandEmpty>{props.emptyLabel ?? "No matching options"}</CommandEmpty>
            <CommandGroup>
              {props.options.map((option, index) => (
                <CommandItem
                  key={`${index}:${option}`}
                  value={option}
                  data-testid={`extension-ui-select-option-${index}`}
                  className="cursor-pointer whitespace-pre-wrap py-2.5 text-[13px] leading-snug"
                  onSelect={() => settleSelect(option)}
                >
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="flex justify-end border-t border-[var(--border)] px-3 py-2">
          <button
            type="button"
            data-testid="extension-ui-select-cancel"
            className="rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            onClick={settleCancel}
          >
            {props.cancelLabel ?? "Cancel"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
