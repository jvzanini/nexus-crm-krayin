"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ChevronLeft, ChevronRight, Target, Users, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RecentActivityItem } from "@/lib/actions/dashboard";

interface RecentActivityProps {
  items: RecentActivityItem[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const typeConfig: Record<string, { label: string; icon: typeof Target; className: string }> = {
  lead: { label: "Lead", icon: Target, className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  contact: { label: "Contato", icon: Users, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  opportunity: { label: "Oportunidade", icon: TrendingUp, className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

const statusLabels: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  unqualified: "Desqualificado",
  converted: "Convertido",
  ativo: "Ativo",
  prospecting: "Prospecção",
  qualification: "Qualificação",
  proposal: "Proposta",
  negotiation: "Negociação",
  closed_won: "Ganho",
  closed_lost: "Perdido",
};

export function RecentActivity({ items, currentPage, totalPages, onPageChange }: RecentActivityProps) {
  return (
    <Card className="bg-card border border-border rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-b-xl overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Quando</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Tipo</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Ação</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Nome</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium h-9">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma atividade no periodo
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => {
                const tc = typeConfig[item.type] ?? typeConfig.lead;
                const TypeIcon = tc.icon;
                return (
                  <TableRow key={`${item.type}-${item.id}`} className="border-border/50 hover:bg-accent/30 transition-colors">
                    <TableCell className="text-xs text-muted-foreground py-2.5">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className={`text-xs inline-flex items-center gap-1 ${tc.className}`}>
                        <TypeIcon className="h-3 w-3" />
                        {tc.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground py-2.5">
                      {item.action}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground py-2.5">
                      {item.entityName}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="outline" className="text-xs border-border text-foreground/80">
                        {statusLabels[item.status] ?? item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Paginacao */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="gap-1 border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Pagina {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="gap-1 border-border text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-200"
            >
              Proxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
