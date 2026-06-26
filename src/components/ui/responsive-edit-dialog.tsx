import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

type Size = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const sizeToMaxW: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  size?: Size;
};

export default function ResponsiveEditDialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = "lg",
}: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading">{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3 overflow-y-auto">{children}</div>
          <DrawerFooter className="flex-row gap-2 border-t pt-3">
            {footer}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${sizeToMaxW[size]} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="font-heading">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
