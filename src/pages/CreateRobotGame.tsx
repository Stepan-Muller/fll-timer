import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Phase = {
  id: number;
  name: string;
  order: number;
  robotgame: number;
};

type RobotGame = {
  id: number;
  name: string;
  season: number;
};

export default function CreateRobotGame() {
  const [robotgame, setRobotgame] = useState<RobotGame | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  // Create new robotgame on page load
  useEffect(() => {
    const createGame = async () => {
      const { data, error } = await supabase
        .from("robotgames")
        .insert({ name: "New RobotGame", season: 2025 })
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        return;
      }

      setRobotgame(data);
      setLoading(false);
    };

    createGame();
  }, []);

  // Load phases for this robotgame
  useEffect(() => {
    if (!robotgame) return;

    const loadPhases = async () => {
      const { data, error } = await supabase
        .from("phases")
        .select("*")
        .eq("robotgame", robotgame.id)
        .order("order", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setPhases(data || []);
    };

    loadPhases();
  }, [robotgame]);

  // Add a new phase
  const addPhase = async () => {
    if (!robotgame) return;

    const newOrder = phases.length > 0 ? Math.max(...phases.map(p => p.order)) + 1 : 0;

    const { data, error } = await supabase
      .from("phases")
      .insert({ name: "New Phase", robotgame: robotgame.id, order: newOrder })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      return;
    }

    setPhases(prev => [...prev, data]);
  };

  // Delete a phase
  const deletePhase = async (id: number) => {
    const { error } = await supabase.from("phases").delete().eq("id", id);
    if (error) {
      console.error(error);
      return;
    }

    setPhases(prev => prev.filter(p => p.id !== id));
  };

  // Move phase up or down
  const movePhase = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= phases.length) return;

    const updated = [...phases];
    // Swap phases
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    // Update order numbers
    updated.forEach((p, i) => (p.order = i));

    setPhases(updated);

    // Update orders in the database
    for (const p of updated) {
      const { error } = await supabase
        .from("phases")
        .update({ order: p.order })
        .eq("id", p.id);
      if (error) console.error(error);
    }
  };

  // Update phase name
  const updatePhaseName = async (id: number, name: string) => {
    const { error } = await supabase
      .from("phases")
      .update({ name })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    setPhases(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  };

  // Update robotgame name
  const updateRobotGameName = async (name: string) => {
    if (!robotgame) return;

    const { error } = await supabase
      .from("robotgames")
      .update({ name })
      .eq("id", robotgame.id);

    if (error) {
      console.error(error);
      return;
    }

    setRobotgame({ ...robotgame, name });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="w-12 h-12 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white p-6 font-sans">
      <h1 className="text-3xl font-bold mb-6">
        <input
          type="text"
          value={robotgame?.name || ""}
          onChange={e => updateRobotGameName(e.target.value)}
          className="p-2 rounded text-black text-3xl font-bold w-full bg-gray-300"
        />
      </h1>

      <button
        onClick={addPhase}
        className="mb-6 px-4 py-2 bg-green-600 hover:bg-green-500 rounded"
      >
        Add Phase
      </button>

      {phases.map((phase, index) => (
        <div
          key={phase.id}
          className="flex items-center mb-4 p-3 bg-gray-800 rounded shadow"
        >
          <input
            type="text"
            placeholder="Phase name"
            value={phase.name}
            onChange={e => updatePhaseName(phase.id, e.target.value)}
            className="flex-1 p-2 mr-4 rounded text-black"
          />

          <div className="flex gap-2">
            <button
              onClick={() => movePhase(index, "up")}
              disabled={index === 0}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↑
            </button>
            <button
              onClick={() => movePhase(index, "down")}
              disabled={index === phases.length - 1}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↓
            </button>
            <button
              onClick={() => deletePhase(phase.id)}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}