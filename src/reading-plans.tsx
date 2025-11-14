import { Action, ActionPanel, Icon, List, Toast, getPreferenceValues, open, showHUD, showToast } from "@raycast/api";
import fs from "fs/promises";
import { useCallback, useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "./utils/errors";
import { findReadingPlanDatabase } from "./logos/installations";
import { getSqlInstance } from "./utils/sql";

type Preferences = {
  documentsDbPath?: string;
};

type Plan = {
  documentId: string;
  title: string;
  modified?: string;
  uri: string;
};

type State = {
  plans: Plan[];
  isLoading: boolean;
  error?: string;
  dbPath?: string;
};

export default function Command() {
  const preferences = useMemo(() => getPreferenceValues<Preferences>(), []);
  const [state, setState] = useState<State>({ plans: [], isLoading: true });

  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, isLoading: true, error: undefined }));
    try {
      const result = await loadReadingPlans(preferences);
      setState({ plans: result.plans, dbPath: result.dbPath, isLoading: false });
    } catch (error) {
      setState({ plans: [], dbPath: undefined, isLoading: false, error: extractErrorMessage(error) });
    }
  }, [preferences]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openPlan = useCallback(async (plan: Plan) => {
    const uris = buildReadingPlanUris(plan);
    let lastError: unknown;

    for (const uri of uris) {
      try {
        await open(uri, LOGOS_BUNDLE_ID);
        await showHUD(`Opening ${plan.title}`);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "Could not open Logos",
      message: `${extractErrorMessage(lastError)} — Tried ${uris.join(", ")}`,
    });
  }, []);

  const emptyDescription = state.error
    ? state.error
    : "No reading plans found. Create one in Logos or point Raycast at ReadingPlan.db.";

  const renderRevealAction = state.dbPath
    ? () => <Action.Open title="Reveal ReadingPlan DB" icon={Icon.Eye} target={state.dbPath} application="Finder" />
    : undefined;

  return (
    <List isLoading={state.isLoading} searchBarPlaceholder="Search reading plans">
      {state.plans.length === 0 && !state.isLoading ? (
        <List.EmptyView
          icon={state.error ? Icon.ExclamationMark : Icon.Book}
          title={state.error ? "Cannot load reading plans" : "No reading plans"}
          description={emptyDescription}
          actions={
            <ActionPanel>
              <Action title="Reload Reading Plans" icon={Icon.ArrowClockwise} onAction={reload} />
              {renderRevealAction ? renderRevealAction() : undefined}
            </ActionPanel>
          }
        />
      ) : (
        state.plans.map((plan) => (
          <List.Item
            key={plan.uri}
            title={plan.title}
            subtitle={plan.modified ? new Date(plan.modified).toLocaleDateString() : undefined}
            icon={Icon.Calendar}
            actions={
              <ActionPanel>
                <Action title="Open Today's Reading" icon={Icon.AppWindow} onAction={() => openPlan(plan)} />
                <Action.CopyToClipboard title="Copy Logos URI" content={plan.uri} />
                <Action title="Reload Reading Plans" icon={Icon.ArrowClockwise} onAction={reload} />
                {renderRevealAction ? renderRevealAction() : undefined}
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}

async function loadReadingPlans(preferences: Preferences) {
  const dbPath = await findReadingPlanDatabase(preferences.documentsDbPath);
  const SQL = await getSqlInstance();
  const file = await fs.readFile(dbPath);
  const database = new SQL.Database(new Uint8Array(file));

  try {
    const result = database.exec(
      "SELECT DocumentId AS documentId, Title AS title, ModifiedDate AS modified FROM ReadingPlanDocuments WHERE IsDeleted = 0 AND DocumentId IS NOT NULL AND Title IS NOT NULL",
    );
    if (!result.length) {
      return { plans: [], dbPath };
    }

    const rows = result[0];
    const plans: Plan[] = rows.values.map((row) => {
      const record = Object.fromEntries(rows.columns.map((column, index) => [column, row[index]]));
      const documentId = String(record.documentId);
      const title = String(record.title);
      const modified = record.modified ? String(record.modified) : undefined;
      return {
        documentId,
        title,
        modified,
        uri: `logos4:Document;id=${documentId}`,
      };
    });
    plans.sort((a, b) => a.title.localeCompare(b.title));
    return { plans, dbPath };
  } finally {
    database.close();
  }
}

function buildReadingPlanUris(plan: Plan) {
  const encodedTitle = encodeURIComponent(plan.title);
  return [
    `logos4:Document;id=${plan.documentId}`,
    `logos:Document;id=${plan.documentId}`,
    `logos4:ReadingPlan;name=${encodedTitle}`,
    `logos:ReadingPlan;name=${encodedTitle}`,
  ];
}
const LOGOS_BUNDLE_ID = "com.logos.desktop.logos";
