import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface LostReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  dealTitle: string;
}

export const LostReasonModal = ({ open, onOpenChange, onConfirm, dealTitle }: LostReasonModalProps) => {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] overflow-y-auto p-0">
        <SheetHeader className="p-6 border-b border-gray-200 dark:border-slate-800">
          <SheetTitle className="text-foreground">Marcar Deal como Perdido</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Você está marcando "{dealTitle}" como perdido. Por favor, informe o motivo.
          </SheetDescription>
        </SheetHeader>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da Perda *</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Cliente escolheu concorrente, orçamento insuficiente, timing inadequado..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <SheetFooter className="p-6 border-t border-gray-200 dark:border-slate-800">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!reason.trim()}
            variant="danger"
          >
            Confirmar Perda
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
