import { Card, CardContent } from "@/components/ui/card";
import StockGuideContent from "@/components/investimentos/StockGuideContent";

export default function StockGuide() {
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <StockGuideContent />
      </CardContent>
    </Card>
  );
}
