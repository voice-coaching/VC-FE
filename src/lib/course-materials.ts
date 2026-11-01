import type {
  ApiContract,
  CourseDetail,
  Id,
  PracticeExamples,
} from "./api/types";
import { orderedCourseExamples } from "./class-practice";

/** Shares hover, detail and start reads; a slow intro request never holds the examples request. */
export function createCourseMaterialRequests(
  api: Pick<ApiContract, "courses" | "examples">,
  owner: string,
) {
  const details = new Map<string, Promise<CourseDetail>>();
  const examples = new Map<string, Promise<PracticeExamples>>();
  function read<T>(
    map: Map<string, Promise<T>>,
    id: Id,
    cached: T | undefined,
    fetch: () => Promise<T>,
  ) {
    if (cached) return Promise.resolve(cached);
    const key = `${owner}:${id}`;
    const pending = map.get(key);
    if (pending) return pending;
    const request = fetch().finally(() => {
      if (map.get(key) === request) map.delete(key);
    });
    map.set(key, request);
    return request;
  }
  return {
    detail: (id: Id, cached?: CourseDetail) =>
      read(details, id, cached, () => api.courses.get(id)),
    examples: (id: Id, cached?: PracticeExamples) =>
      read(
        examples,
        id,
        cached ? orderedCourseExamples(cached, id) : undefined,
        async () =>
          orderedCourseExamples(await api.examples.listCourse(id), id),
      ),
  };
}
