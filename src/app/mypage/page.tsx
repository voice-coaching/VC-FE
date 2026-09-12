import MyPage from "@/routes/mypage";
import PrototypeMyPage from "@/routes/prototype-mypage";

export default function Page() {
  return process.env.NODE_ENV === "development" ? (
    <PrototypeMyPage />
  ) : (
    <MyPage />
  );
}
