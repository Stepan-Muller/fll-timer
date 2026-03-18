import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Timer from "./pages/Timer"
import RunsList from "./pages/RunsList"

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/timer/:robotgameId" element={<Timer />} />
          <Route path="/runslist/:robotgameId" element={<RunsList />} />

          <Route path="/" element={<Navigate to="/runslist/2" />} />
        </Routes>
    </BrowserRouter>
  )
}