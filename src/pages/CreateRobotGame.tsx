import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

// --- Types ---

type Phase = {
  id: number;
  color: string | null;
  name: string;
  order: number;
  robotgame: number;
  missionParts: MissionPart[];
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

// --- Sub-Components ---

function DroppableSidebar({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="px-6 py-2 bg-gray-800 overflow-y-auto"
    >
      {children}
    </div>
  );
}

function MissionPartItem({ part, isOverlay }: { part: MissionPart; isOverlay?: boolean }) {
  return (
    <div
      className={`p-4 pt-3 bg-gray-700 rounded-lg shadow overflow-hidden font-normal border transition-colors ${isOverlay ? "border-blue-500 cursor-grabbing bg-gray-600" : "border-transparent cursor-grab"
        }`}
    >
      <div className="font-bold mb-2">
        {part.mission.display_number &&
          `M${String(part.mission.display_number).padStart(2, "0")} `}
        {part.mission.name}
      </div>
      {part.description && <div className="mb-2 text-gray-300">{part.description}</div>}
      <div className="flex w-full outline rounded overflow-hidden outline-1 outline-gray-600">
        {part.mission_options.map((option) => (
          <div
            key={option.id}
            className="flex-1 p-2 text-sm border-l border-gray-600 bg-gray-800 first:border-l-0"
          >
            {option.description}
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableMissionPart({ part, disableSorting }: { part: MissionPart; disableSorting?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: part.id,
      data: { type: "missionpart", part },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    // Disable transition for the inventory items so they don't slide around
    transition: disableSorting ? undefined : transition,
    opacity: isDragging ? 0.3 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="my-4">
      <MissionPartItem part={part} />
    </div>
  );
}

function Phase({
  phase,
  updatePhaseName,
  updatePhaseColor, // New prop
  deletePhase,
  children,
}: {
  phase: Phase;
  updatePhaseName: (id: number, name: string) => void;
  updatePhaseColor: (id: number, color: string) => void;
  deletePhase: (id: number) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } =
    useSortable({
      id: phase.id,
      data: { type: "phase", phase },
    });

  const { setNodeRef: setDroppableRef } = useDroppable({ id: phase.id });

  // Format the hex for CSS (ensure it has the #)
  const displayColor = phase.color ? `#${phase.color}` : "transparent";

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    // Apply the chosen color as a left border
    borderLeft: phase.color ? `4px solid ${displayColor}` : '4px solid transparent',
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className="bg-gray-800 mt-6 font-bold rounded-lg outline outline-1 outline-gray-700 overflow-hidden transition-all"
    >
      <div
        className="flex items-center w-full bg-gray-750 border-b border-gray-700"
        style={{ backgroundColor: phase.color ? `${displayColor}15` : '' }} // Subtle 15% opacity tint
      >
        <div
          {...attributes}
          {...listeners}
          className="p-2 text-gray-400 cursor-grab hover:text-white"
        >
          ☰
        </div>
        <input
          type="text"
          value={phase.name}
          onChange={(e) => updatePhaseName(phase.id, e.target.value)}
          className="flex-1 px-4 py-2 bg-transparent text-white focus:outline-none font-bold"
        />

        {/* --- Color Picker Section --- */}
        <div className="relative flex items-center mr-2">
          <label
            htmlFor={`color-${phase.id}`}
            className="w-6 h-6 rounded-full cursor-pointer border border-gray-500 hover:scale-110 transition-transform shadow-inner"
            style={{ backgroundColor: displayColor }}
          >
            <input
              id={`color-${phase.id}`}
              type="color"
              className="sr-only" // Hidden visually, but active
              value={displayColor === "transparent" ? "#4B5563" : displayColor}
              onChange={(e) => updatePhaseColor(phase.id, e.target.value)}
            />
          </label>
        </div>

        <button
          onClick={() => {
            deletePhase(phase.id);
          }}
          className="px-3 py-1 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
        >
          <i className="uil uil-trash-alt"></i>
        </button>
      </div>

      <div ref={setDroppableRef} className="px-4 pb-4 min-h-[80px] bg-gray-850/30">
        {children}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function CreateRobotGame() {
  const [robotgame, setRobotgame] = useState<RobotGame | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [missionParts, setMissionParts] = useState<MissionPart[]>([]);
  const [loading, setLoading] = useState(true);

  const [activePart, setActivePart] = useState<MissionPart | null>(null);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);

  const sourceContainerRef = useRef<string | number | null>(null);

  const createdRef = useRef(false);
  const navigate = useNavigate();

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }
  }));

  const findContainer = (id: number | string) => {
    if (id === "unassigned") return "unassigned";

    // Check inventory (ensure string comparison)
    if (missionParts.some((p) => String(p.id) === String(id))) {
      return "unassigned";
    }

    // Check phases
    const phaseMatch = phases.find((p) =>
      String(p.id) === String(id) ||
      p.missionParts?.some((m) => String(m.id) === String(id))
    );

    return phaseMatch ? phaseMatch.id : null;
  };

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    const init = async () => {
      const { data: game } = await supabase.from("robotgames").insert({ name: "New RobotGame", season: 2025 }).select().single();
      if (game) setRobotgame(game);

      const { data: parts } = await supabase.from("mission_parts").select(`id, description, mission:missions(id, name, display_number), mission_options(id, description)`).order("id", { ascending: true });
      if (parts) setMissionParts(parts.map((p: any) => ({ ...p, mission: Array.isArray(p.mission) ? p.mission[0] : p.mission })));

      setLoading(false);
    };
    init();
  }, []);

  const handleDragStart = (event: any) => {
    const { active } = event;
    const container = findContainer(active.id); // Where is it starting?
    sourceContainerRef.current = container;

    if (active.data.current.type === "missionpart") {
      setActivePart(active.data.current.part);
    } else {
      setActivePhase(active.data.current.phase);
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    // 1. INTERNAL REORDERING (Same Phase)
    if (activeContainer === overContainer && activeContainer !== "unassigned") {
      setPhases((prev) => prev.map((ph) => {
        if (ph.id === activeContainer) {
          const oldIndex = ph.missionParts.findIndex((m) => String(m.id) === String(activeId));
          const newIndex = ph.missionParts.findIndex((m) => String(m.id) === String(overId));

          // Only update if indices actually changed
          if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
            return { ...ph, missionParts: arrayMove(ph.missionParts, oldIndex, newIndex) };
          }
        }
        return ph;
      }));
      return;
    }

    // 2. CROSS-CONTAINER MOVE (Inventory <-> Phase or Phase <-> Phase)
    if (activeContainer !== overContainer) {
      setPhases((prev) => {
        let movedItem: MissionPart | undefined;

        // Extract item from source
        if (activeContainer === "unassigned") {
          movedItem = missionParts.find((m) => String(m.id) === String(activeId));
          if (movedItem) setMissionParts((p) => p.filter((i) => String(i.id) !== String(activeId)));
        } else {
          movedItem = prev.find((p) => p.id === activeContainer)?.missionParts.find((m) => String(m.id) === String(activeId));
        }

        if (!movedItem) return prev;

        // Remove from source phase
        const cleanedPhases = prev.map((ph) => (
          ph.id === activeContainer
            ? { ...ph, missionParts: ph.missionParts.filter((m) => String(m.id) !== String(activeId)) }
            : ph
        ));

        // Handle move back to inventory
        if (overContainer === "unassigned") {
          setMissionParts((p) => {
            if (p.some(i => String(i.id) === String(activeId))) return p;
            return [...p, movedItem!].sort((a, b) => a.id - b.id);
          });
          return cleanedPhases;
        }

        // Add to destination phase
        return cleanedPhases.map((ph) => {
          if (ph.id === overContainer) {
            const overIndex = ph.missionParts.findIndex((m) => String(m.id) === String(overId));
            const newIndex = overIndex >= 0 ? overIndex : ph.missionParts.length;

            const filtered = ph.missionParts.filter(m => String(m.id) !== String(activeId));
            const updated = [...filtered];
            updated.splice(newIndex, 0, movedItem!);
            return { ...ph, missionParts: updated };
          }
          return ph;
        });
      });
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActivePart(null);
    setActivePhase(null);

    if (!over) {
      sourceContainerRef.current = null;
      return;
    }

    const activeId = active.id;
    const overId = over.id;
    const startContainer = sourceContainerRef.current;
    const currentContainer = findContainer(activeId);

    // 1. PHASE REORDERING
    if (active.data.current?.type === "phase") {
      if (activeId !== overId) {
        const oldIdx = phases.findIndex((p) => p.id === activeId);
        const newIdx = phases.findIndex((p) => p.id === overId);
        const updated = arrayMove(phases, oldIdx, newIdx).map((p, i) => ({ ...p, order: i }));
        setPhases(updated);
        await updatePhasesOrder(updated);
      }
      return;
    }

    // 2. MISSION PART SYNC
    // State is already updated by DragOver! Just persist the final reality.
    if (active.data.current?.type === "missionpart") {
      if (currentContainer && currentContainer !== "unassigned") {
        // Persist where it landed
        await persistPartInPhase(activeId as number, currentContainer as number, phases);

        // If it changed phases, re-index the source phase
        if (startContainer && startContainer !== "unassigned" && startContainer !== currentContainer) {
          await persistPartInPhase(null, startContainer as number, phases);
        }
      }
      else if (currentContainer === "unassigned" && startContainer !== "unassigned") {
        // It was moved to inventory
        await removePartFromPhase(activeId as number);
        await persistPartInPhase(null, startContainer as number, phases);
      }
    }

    sourceContainerRef.current = null;
  };

  const updatePhasesOrder = async (updatedPhases: Phase[]) => {
    // We only send the ID and the Order to keep the payload small
    const payload = updatedPhases.map((phase) => ({
      id: phase.id,
      order: phase.order,
      robotgame: robotgame?.id, // Ensure foreign key is present if your RLS requires it
      name: phase.name, // Include name to satisfy non-null constraints if necessary
    }));

    const { error } = await supabase
      .from("phases")
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error("Error syncing phase order:", error.message);
    }
  };

  const removePartFromPhase = async (partId: number) => {
    const currentPhaseIds = phases.map(p => p.id);
    console.log("ttt");
    const { error } = await supabase
      .from("mission_parts_phases")
      .delete()
      .eq("mission_part", partId)
      .in("phase", currentPhaseIds);

    if (error) console.error("Error removing part from game phases:", error.message);
  };

  const persistPartInPhase = async (partId: number | null, phaseId: number, currentPhases: Phase[]) => {
    const targetPhase = currentPhases.find((p) => p.id === phaseId);
    if (!targetPhase) return;

    const currentPhaseIds = currentPhases.map(p => p.id);

    if (partId) {
      await supabase
        .from("mission_parts_phases") // Fixed name to plural
        .delete()
        .eq("mission_part", partId)
        .in("phase", currentPhaseIds);
    }

    const payload = targetPhase.missionParts.map((part, index) => ({
      mission_part: part.id,
      phase: phaseId,
      order: index,
    }));

    if (payload.length > 0) {
      const { error } = await supabase
        .from("mission_parts_phases")
        .upsert(payload, { onConflict: "mission_part,phase" });

      if (error) console.error("Error syncing phase parts:", error.message);
    }
  };

  const addPhase = async () => {
    if (!robotgame) {
      console.error("Cannot add phase: Robot game not loaded.");
      return;
    }

    // 1. Prepare the new phase data
    // The 'order' is simply the current number of phases
    const newOrder = phases.length;
    const defaultName = "New Phase";

    const { data, error } = await supabase
      .from("phases")
      .insert({
        name: defaultName,
        robotgame: robotgame.id,
        order: newOrder,
        color: null, // Keeping empty for now
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating phase in database:", error.message);
      return;
    }

    if (data) {
      // 2. Update local state with the saved phase
      // We ensure missionParts is initialized as an empty array for our dnd logic
      const savedPhase: Phase = {
        ...data,
        missionParts: [],
      };

      setPhases((prev) => [...prev, savedPhase]);
    }
  };

  const deletePhase = async (id: number) => {
    // 1. Find the phase to be deleted to rescue its mission parts
    const phaseToDelete = phases.find((p) => p.id === id);
    if (!phaseToDelete) return;

    // 2. Rescue mission parts (move them back to the left menu)
    if (phaseToDelete.missionParts.length > 0) {
      setMissionParts((prev) => {
        const updated = [...prev, ...phaseToDelete.missionParts];
        return updated.sort((a, b) => a.id - b.id); // Keep inventory sorted by ID
      });
    }

    // 3. Calculate the new local state for remaining phases
    const remainingPhases = phases
      .filter((p) => p.id !== id)
      .map((p, index) => ({
        ...p,
        order: index, // Re-index to ensure no gaps
      }));

    // 4. Update local state immediately
    setPhases(remainingPhases);

    // 5. Database Operations
    try {
      // Delete the phase
      const { error: deleteError } = await supabase
        .from("phases")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      // Update the order of remaining phases in Supabase
      if (remainingPhases.length > 0) {
        const payload = remainingPhases.map((p) => ({
          id: p.id,
          order: p.order,
          name: p.name,
          robotgame: robotgame?.id,
        }));

        await supabase.from("phases").upsert(payload);
      }
    } catch (error: any) {
      console.error("Error during phase deletion:", error.message);
    }
  };

  const updatePhaseName = async (id: number, name: string) => {
    // 1. Update local state immediately for a snappy UI
    setPhases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );

    // 2. Persist to Supabase
    const { error } = await supabase
      .from("phases")
      .update({ name })
      .eq("id", id);

    if (error) {
      console.error(`Error updating phase ${id} name:`, error.message);
      // Optional: You could fetch the phases again here to "rollback" 
      // the UI if the database update failed.
    }
  };

  const updatePhaseColor = async (id: number, color: string) => {
    // Strip the '#' if present for database storage (e.g., #FFFFFF -> FFFFFF)
    const hexValue = color.startsWith("#") ? color.slice(1) : color;

    // 1. Update local state
    setPhases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, color: hexValue } : p))
    );

    // 2. Persist to Supabase
    const { error } = await supabase
      .from("phases")
      .update({ color: hexValue })
      .eq("id", id);

    if (error) console.error("Error updating phase color:", error.message);
  };

  const updateRobotGameName = async (name: string) => {
    if (!robotgame) return;

    // 1. Update local state immediately for a snappy UI
    setRobotgame({ ...robotgame, name });

    // 2. Persist to Supabase
    const { error } = await supabase
      .from("robotgames")
      .update({ name })
      .eq("id", robotgame.id);

    if (error) {
      console.error("Error updating robot game name:", error.message);
      // Optional: Rollback state if the database update fails
    }
  };

  if (loading) return <div className="h-screen bg-gray-900 flex items-center justify-center text-white">Loading Editor...</div>;

  return (
    <div className="h-screen w-screen bg-gray-900 text-white font-sans flex flex-col overflow-hidden">
      <header className="w-full flex justify-between bg-gray-800 shadow-md sticky top-0 text-3xl font-bold">
        <div className="pl-6 my-4 w-[calc(50%-16px)] text-left">
          <button onClick={() => navigate(`/robotgameslist`)} className="underline hover:text-gray-300">
            HobbyRobot FLL scorer
          </button>
        </div>
        <input
          type="text"
          placeholder="Untitled Robot Game"
          value={robotgame?.name || ""}
          onChange={(e) => updateRobotGameName(e.target.value)}
          className="px-6 py-4 w-[calc(50%+16px)] bg-gray-800 hover:bg-gray-700 text-right"
        />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* LEFT Sidebar */}
          <div className="w-[calc(50%-16px)] overflow-auto">
            <DroppableSidebar id="unassigned">
              <SortableContext
                id="unassigned"
                items={missionParts.map((p) => p.id)}
                strategy={() => null}
              >
                {missionParts.map((part) => (
                  <SortableMissionPart key={part.id} part={part} disableSorting={true} />
                ))}
              </SortableContext>
            </DroppableSidebar>
          </div>

          {/* RIGHT Workspace */}
          <div className="w-[calc(50%+16px)] p-6 pt-0 bg-gray-900 overflow-y-auto">
            <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {phases.map((phase) => (
                <Phase key={phase.id} phase={phase} updatePhaseName={updatePhaseName} updatePhaseColor={updatePhaseColor} deletePhase={deletePhase}>
                  <SortableContext
                    id={String(phase.id)} // Add the ID here
                    items={phase.missionParts.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {phase.missionParts.map((part) => (
                      <SortableMissionPart key={part.id} part={part} />
                    ))}
                  </SortableContext>
                </Phase>
              ))}
            </SortableContext>
            <button
              onClick={addPhase}
              className="mt-6 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold"
            >
              Create New Phase
            </button>
          </div>

          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: '0.3' } },
            }),
          }}>
            {activePart ? <MissionPartItem part={activePart} isOverlay /> : null}
            {activePhase ? (
              <div className="opacity-90 shadow-2xl scale-105">
                <Phase phase={activePhase} updatePhaseName={() => { }} updatePhaseColor={() => { }} deletePhase={() => { }}>
                  {activePhase.missionParts.map(p => <MissionPartItem key={p.id} part={p} />)}
                </Phase>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}