import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { supabaseRetry } from "../utils/supabase";

type Season = {
  year: number;
  name: string;
};

type RobotGame = {
  id: number;
  name: string;
  season: number;
};

export default function RobotGamesList() {
  const [games, setGames] = useState<RobotGame[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: gamesData, error: gamesError } = await await supabaseRetry(async () =>
      supabase
        .from("robotgames")
        .select("id, name, season")
    );

    if (gamesError) {
      console.error(gamesError);
      setLoading(false);
      return;
    }

    const { data: seasonsData, error: seasonsError } = await supabaseRetry(async () =>
      supabase
        .from("seasons")
        .select("year, name")
    );

    if (seasonsError) {
      console.error(seasonsError);
      setLoading(false);
      return;
    }

    setGames(gamesData || []);
    setSeasons(seasonsData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="w-12 h-12 border-4 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Group games by season (newest first)
  const groupedGames = [...seasons]
    .sort((a, b) => b.year - a.year)
    .map((season) => ({
      season,
      games: games
        .filter((g) => g.season === season.year)
        .sort((a, b) => b.id - a.id), // reverse order
    }));

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <header className="w-full flex px-6 py-4 bg-gray-800 shadow-md">
        <div className="text-3xl font-bold w-full flex justify-center">
          Robot Games
        </div>
      </header>

      <div className="px-6 pb-2">
        {groupedGames.map((group) => (
          <div key={group.season.year}>
            {/* Season Header */}
            <div
              className="font-bold text-2xl px-4 py-2 mt-6 mb-4 rounded-lg shadow-md"
              style={{
                backgroundColor: "#374151",
                color: "#ffffff",
              }}
            >
              {group.season.year} – {group.season.name}
            </div>

            {/* Games */}
            {group.games.map((game) => (
              <div
                key={game.id}
                className="mb-4 px-4 py-2 rounded-lg bg-gray-800 flex hover:bg-gray-700 cursor-pointer"
                onClick={() => navigate(`/runslist/${game.id}`)}
              >
                <div className="w-full text-lg font-semibold">
                  {game.name}
                </div>
              </div>
            ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}