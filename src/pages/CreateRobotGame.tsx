import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

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

type MissionPart = {
  id: number;
  description: string | null;
  mission: {
    id: number;
    name: string;
    display_number: number | null;
  };
  mission_options: {
    id: number;
    description: string;
  }[];
};

function SortableItem({
  phase,
  updatePhaseName,
  deletePhase,
}: {
  phase: Phase;
  updatePhaseName: (id: number, name: string) => void;
  deletePhase: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center bg-gray-800 mt-6 font-bold rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="px-4 py-2 text-gray-400 cursor-grab active:cursor-grabbing"
      >
        ☰
      </div>

      <input
        type="text"
        placeholder="Phase name"
        value={phase.name}
        onChange={(e) => updatePhaseName(phase.id, e.target.value)}
        className="flex-1 px-4 py-2 text-black bg-none"
      />

      <button
        onClick={() => deletePhase(phase.id)}
        className="px-4 py-2"
      >
        Delete
      </button>
    </div>
  );
}

export default function CreateRobotGame() {
  const [robotgame, setRobotgame] = useState<RobotGame | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [missionParts, setMissionParts] = useState<MissionPart[]>([]);
  const [loading, setLoading] = useState(true);

  const createdRef = useRef(false);
  const navigate = useNavigate();

  const sensors = useSensors(useSensor(PointerSensor));

  // Create new robotgame
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

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

  // Load phases
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

  // Load mission parts
  useEffect(() => {
    const loadMissionParts = async () => {
      const { data, error } = await supabase
        .from("mission_parts")
        .select(`
        id,
        description,
        mission:missions (
          id,
          name,
          display_number
        ),
        mission_options (
          id,
          description
        )
      `)
        .order("id", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      // unwrap mission array
      const fixed: MissionPart[] = (data || []).map((item: any) => {
        const missionRaw = item.mission;

        const mission = Array.isArray(missionRaw)
          ? missionRaw[0]
          : missionRaw;

        return {
          id: item.id,
          description: item.description,
          mission: mission ?? {
            id: 0,
            name: "",
            display_number: null,
          },
          mission_options: item.mission_options || [],
        };
      });

      setMissionParts(fixed);
    };

    loadMissionParts();
  }, []);

  // Add phase
  const addPhase = async () => {
    if (!robotgame) return;

    const newOrder =
      phases.length > 0 ? Math.max(...phases.map((p) => p.order)) + 1 : 0;

    const { data, error } = await supabase
      .from("phases")
      .insert({
        name: "New Phase",
        robotgame: robotgame.id,
        order: newOrder,
      })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      return;
    }

    setPhases((prev) => [...prev, data]);
  };

  // Delete phase
  const deletePhase = async (id: number) => {
    const { error } = await supabase.from("phases").delete().eq("id", id);
    if (error) {
      console.error(error);
      return;
    }

    setPhases((prev) => prev.filter((p) => p.id !== id));
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

    setPhases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
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

  // Drag end
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);

    const updated = arrayMove(phases, oldIndex, newIndex);
    updated.forEach((p, i) => (p.order = i));
    setPhases(updated);

    for (const p of updated) {
      await supabase
        .from("phases")
        .update({ order: p.order })
        .eq("id", p.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="w-12 h-12 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="w-full flex justify-between bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="text-3xl font-bold flex items-center mx-6 my-4">
          <button
            onClick={() => navigate(`/robotgameslist`)}
            className="underline hover:text-gray-300"
          >
            HobbyRobot FLL scorer
          </button>
        </div>

        <h1 className="w-1/2">
          <input
            type="text"
            value={robotgame?.name || ""}
            onChange={(e) => updateRobotGameName(e.target.value)}
            className="px-6 py-4 text-3xl font-bold w-full bg-gray-800 hover:bg-gray-700 text-right"
          />
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Mission Parts list */}
        <div className="w-[calc(50%-16px)] p-6 pb-2 bg-gray-800 overflow-y-auto">
          {missionParts.map((part) => (
            <div
              key={part.id}
              className="mb-4 p-4 pt-3 bg-gray-700 rounded-lg shadow overflow-hidden"
            >
              <div className="font-bold mb-2">
                {part.mission.display_number &&
                  `M${String(part.mission.display_number).padStart(2, "0")} `}
                {part.mission.name}
              </div>

              {part.description && (
                <div className="mb-2">{part.description}</div>
              )}

              <div className="flex w-full outline rounded overflow-hidden outline-1 outline-gray-600">
                {part.mission_options.map((option) => (
                  <div
                    key={option.id}
                    className="flex-1 px-2 py-2 text-sm border-l border-gray-600 bg-gray-800 first:border-l-0"
                  >
                    {option.description}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT */}
        <div className="w-[calc(50%+16px)] p-6 pt-0 bg-gray-850 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext
              items={phases.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {phases.map((phase) => (
                <SortableItem
                  key={phase.id}
                  phase={phase}
                  updatePhaseName={updatePhaseName}
                  deletePhase={deletePhase}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            onClick={addPhase}
            className="font-bold px-4 py-2 mt-6 rounded-lg bg-gray-800 hover:bg-gray-700 w-full"
          >
            Add Phase
          </button>
        </div>
      </div>
    </div>
  );
}