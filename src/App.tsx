import { BrowserRouter, Routes, Route } from "react-router-dom"
import Timer from "./pages/Timer"
import RunsList from "./pages/RunsList"

export default function App() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/timer" element={<Timer />} />
          <Route path="/runslist" element={<RunsList />} />

          <Route path="/" element={<Timer />} />
        </Routes>
    </BrowserRouter>
  )
}