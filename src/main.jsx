import ReactDOM from "react-dom/client";
import App from "./app.jsx";
import "./index.css";
import "./styles/tokens.css";

/*  StrictMode 제거 사유:
 *    개발 모드에서 useEffect 이중 실행으로 인해 side-effect 성 API 호출이
 *    두 번 나가는 문제(end 페이지 expireSession 이중 호출 → 두 번째 404)를
 *    유발했음. 프로덕션 빌드에는 StrictMode 가 원래 적용되지 않으므로 배포
 *    동작에는 영향이 없고, 대신 dev/prod 동작이 일치해 디버깅이 편해진다.  */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
