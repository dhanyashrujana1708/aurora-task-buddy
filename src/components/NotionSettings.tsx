import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

interface NotionSettingsProps {
  userId: string;
  notionApiKey: string | null;
  notionDatabaseId: string | null;
  onUpdate: () => void;
}

export const NotionSettings = ({
  userId,
  notionApiKey,
  notionDatabaseId,
  onUpdate,
}: NotionSettingsProps) => {
  const [apiKey, setApiKey] = useState(notionApiKey || "");
  const [databaseId, setDatabaseId] = useState(notionDatabaseId || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notion_api_key: apiKey,
          notion_database_id: databaseId,
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Notion settings saved!");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    if (!apiKey || !databaseId) {
      toast.error("Please save your Notion credentials first");
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "import-notion-tasks",
        {
          body: { notionDatabaseId: databaseId },
        }
      );

      if (error) throw error;

      toast.success(
        `Import complete! ${data.imported} tasks imported, ${data.skipped} skipped.`
      );
      onUpdate();
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="notion-api-key">Notion API Key</Label>
        <Input
          id="notion-api-key"
          type="password"
          placeholder="secret_xxxxxxxxxxxxx"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Get your API key from{" "}
          <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Notion Integrations
          </a>
        </p>
      </div>

      <div>
        <Label htmlFor="notion-database-id">Notion Database ID</Label>
        <Input
          id="notion-database-id"
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={databaseId}
          onChange={(e) => setDatabaseId(e.target.value)}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Copy the database ID from your Notion database URL
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !apiKey || !databaseId}
          className="flex-1"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Credentials
        </Button>

        <Button
          onClick={handleImport}
          disabled={isImporting || !apiKey || !databaseId}
          variant="secondary"
          className="flex-1"
        >
          {isImporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Import Tasks
        </Button>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <p className="font-semibold mb-1">How to set up Notion:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Create an integration at notion.so/my-integrations</li>
          <li>Copy the "Internal Integration Token"</li>
          <li>Open your Notion database and click "..." → Connections</li>
          <li>Add your integration to the database</li>
          <li>Copy the database ID from the URL</li>
        </ol>
      </div>
    </div>
  );
};
