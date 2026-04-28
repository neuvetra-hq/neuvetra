import { BrowserRouter, Routes, Route } from "react-router"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="p-8 text-xl font-semibold">Terrascope — coming soon</div>} />
      </Routes>
    </BrowserRouter>
  )
}
