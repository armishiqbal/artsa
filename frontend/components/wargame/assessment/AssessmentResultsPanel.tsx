"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { AssessmentRiskHero } from "@/components/wargame/assessment/AssessmentRiskHero";
import { AssessmentCategoryBars } from "@/components/wargame/assessment/AssessmentCategoryBars";
import { AssessmentTestTable } from "@/components/wargame/assessment/AssessmentTestTable";
import { AssessmentResultDetail } from "@/components/wargame/assessment/AssessmentResultDetail";
import {
  deriveAssessmentCategoryRows,
  deriveAssessmentRiskOverview,
  deriveAssessmentTestRows,
  exportResultsCsv,
  exportResultsJson,
  type AssessmentTestRow,
} from "@/lib/assessmentResults";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

interface AssessmentResultsPanelProps {
  turns: TranscriptTurn[];
  campaignId?: string | null;
  title?: string;
  subtitle?: string;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AssessmentResultsPanel({
  turns,
  campaignId,
  title,
  subtitle,
}: AssessmentResultsPanelProps) {
  const overview = useMemo(() => deriveAssessmentRiskOverview(turns), [turns]);
  const categories = useMemo(() => deriveAssessmentCategoryRows(turns), [turns]);
  const tests = useMemo(() => deriveAssessmentTestRows(turns), [turns]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTurn = useMemo(() => {
    const row = tests.find((t) => t.id === selectedId) ?? tests[0];
    if (!row) return null;
    return turns.find((t) => t.roundNumber === row.roundNumber) ?? null;
  }, [tests, selectedId, turns]);

  const handleSelect = (row: AssessmentTestRow) => setSelectedId(row.id);

  return (
    <div className="space-y-4">
      <AssessmentRiskHero
        overview={overview}
        title={title}
        subtitle={subtitle}
        actions={
          turns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    `scan-${campaignId ?? "results"}.json`,
                    exportResultsJson({
                      campaignId: campaignId ?? "",
                      overview,
                      categories,
                      tests,
                      turns,
                    }),
                    "application/json"
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    `scan-${campaignId ?? "results"}.csv`,
                    exportResultsCsv(tests),
                    "text/csv"
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          ) : null
        }
      />

      <Tabs defaultValue="category">
        <TabsList className="h-8">
          <TabsTrigger value="category" className="text-xs">
            By category
          </TabsTrigger>
          <TabsTrigger value="test" className="text-xs">
            By test
          </TabsTrigger>
        </TabsList>
        <TabsContent value="category" className="mt-3">
          <DashboardCard
            title="Risk by category"
            description="Security · Safety · Responsible — Risk lenses"
          >
            <AssessmentCategoryBars rows={categories} />
          </DashboardCard>
        </TabsContent>
        <TabsContent value="test" className="mt-3 space-y-4">
          <DashboardCard
            title="Results by test"
            description="Click a row to inspect conversation and evaluation"
            contentClassName="!p-0"
          >
            <AssessmentTestTable
              rows={tests}
              selectedId={selectedId ?? tests[0]?.id}
              onSelect={handleSelect}
            />
          </DashboardCard>
          <AssessmentResultDetail turn={selectedTurn} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
