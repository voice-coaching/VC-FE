import { api, type PracticeContent } from "./api";

// VC-BE currently exposes custom-content creation, but no library/topic CRUD.
export const SCRIPT_LIBRARY_AVAILABLE = false;
export const SCRIPT_LIBRARY_UNAVAILABLE_MESSAGE =
  "내 원고 보관함은 준비 중이에요. 입력한 원고로 바로 연습할 수 있어요.";
async function unavailable(): Promise<never> {
  throw new Error(SCRIPT_LIBRARY_UNAVAILABLE_MESSAGE);
}
export type ScriptTopic = { id: number; name: string };
export type ScriptLibrary = {
  items: PracticeContent[];
  topics: ScriptTopic[];
  assignments: Record<string, string>;
};
export const scriptLibrary = {
  list: (): Promise<ScriptLibrary> => unavailable(),
  save: (
    id: string | number | null,
    input: { title: string; scriptText: string; topicId: number | null },
    key: string,
  ): Promise<PracticeContent> => {
    if (id != null) return unavailable();
    return api.content.createCustom(
      {
        title: input.title,
        scriptText: input.scriptText,
        learningFocus: "PRONUNCIATION",
        retention: "SESSION_HISTORY",
        locale: "ko-KR",
      },
      key,
    );
  },
  remove: (_ids: (string | number)[]): Promise<void> => unavailable(),
  createTopic: (_name: string): Promise<ScriptTopic> => unavailable(),
  renameTopic: (_id: number, _name: string): Promise<ScriptTopic> =>
    unavailable(),
  removeTopic: (_id: number): Promise<void> => unavailable(),
};
