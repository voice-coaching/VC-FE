"use client";
import { useAdminActor } from "../actor";
import { changeMemberRole } from "../services";
import type { Member } from "../types";
import { ConfirmAction, Message, Panel, label } from "./shared";

export function MemberRolePanel({ member }: { member: Member }) {
  const actor = useAdminActor();
  const self = actor?.id === member.id;
  const target = member.role === "ADMIN" ? "USER" : "ADMIN";
  const actionLabel = target === "ADMIN" ? "관리자 지정" : "관리자 해제";
  return (
    <Panel title="관리자 권한" padded>
      <Message>
        현재 권한: {label(member.role)}. 관리자 지정 시 관리 화면과 운영 기능에
        접근할 수 있습니다. 새로 지정된 회원은 다시 로그인해야 합니다.
      </Message>
      {self && (
        <Message>
          현재 로그인한 본인의 관리자 권한은 변경할 수 없습니다.
        </Message>
      )}
      {member.status !== "ACTIVE" && (
        <Message>활성 회원의 권한만 변경할 수 있습니다.</Message>
      )}
      <ConfirmAction
        key={`${member.id}-${member.role}`}
        title={`${member.nickname}님을 ${actionLabel}할까요?`}
        description={
          target === "ADMIN"
            ? "이 회원에게 관리자 운영 권한을 부여합니다."
            : "이 회원의 관리자 접근 권한을 즉시 해제합니다."
        }
        buttonLabel={actionLabel}
        danger={target === "USER"}
        disabled={!actor || self || member.status !== "ACTIVE"}
        invalidationPaths={["/users", "/audit-logs"]}
        action={(reason) =>
          changeMemberRole(member.id, member.role, target, reason)
        }
      />
    </Panel>
  );
}
