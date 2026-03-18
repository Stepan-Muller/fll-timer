import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Timer from "./pages/Timer"
import RunsList from "./pages/RunsList"
import RobotGamesList from "./pages/RobotGamesList"

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/timer/:robotgameId" element={<Timer />} />
          <Route path="/runslist/:robotgameId" element={<RunsList />} />
          <Route path="/robotgameslist" element={<RobotGamesList />} />

          <Route path="/" element={<Navigate to="/robotgameslist" />} />
        </Routes>
    </BrowserRouter>
  )
}