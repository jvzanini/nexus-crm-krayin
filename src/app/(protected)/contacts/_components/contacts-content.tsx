"use client";

import { motion } from "framer-motion";
import { Users, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/generated/prisma/client";

interface ContactsContentProps {
  contacts: Contact[];
}

export function ContactsContent({ contacts }: ContactsContentProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/10 border border-emerald-600/20">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Contatos</h1>
            <p className="text-sm text-muted-foreground">
              {contacts.length} contato{contacts.length !== 1 ? "s" : ""} cadastrado{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo contato
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      >
        <Card>
          <CardContent className="p-0">
            {contacts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhum contato encontrado
              </div>
            ) : (
              <div className="divide-y divide-border">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-semibold shrink-0">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {contact.firstName} {contact.lastName}
                      </p>
                      {contact.email && (
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      )}
                    </div>
                    {contact.organization && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {contact.organization}
                      </span>
                    )}
                    {contact.title && (
                      <span className="text-xs text-muted-foreground hidden md:block">
                        {contact.title}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
