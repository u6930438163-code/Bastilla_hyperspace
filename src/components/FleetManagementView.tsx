import React, { useMemo, useState } from 'react';
import {
  Activity,
  Compass,
  Cpu,
  FlaskConical,
  Leaf,
  MessagesSquare,
  Navigation as NavIcon,
  Orbit,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DataStore } from '../kernel/svlKernel';
import {
  BotanyDome,
  DEFAULT_SOLAR_SYSTEM_BODIES,
  FleetShip,
  FleetState,
  normalizeFleetState,
  SolarSystemBody,
} from '../kernel/fleetAndUiState';
import { AgentProtocolRequest } from '../kernel/agentProtocol';

interface FleetManagementViewProps {
  dataStore: DataStore;
  onUpdateDataStore?: React.Dispatch<React.SetStateAction<DataStore>>;
  onSendMessage?: (
    message: string,
    agent?: AgentProtocolRequest['agent'],
  ) => Promise<void>;
  onNavigateToChat?: () => void;
}

export const FleetManagementView: React.FC<FleetManagementViewProps> = ({
  dataStore,
  onUpdateDataStore,
  onSendMessage,
  onNavigateToChat,
}) => {
  const fleetState: FleetState = useMemo(
    () => normalizeFleetState(dataStore.config?.fleet_state),
    [dataStore.config?.fleet_state],
  );

  const [activeSubTab, setActiveSubTab] = useState<'map' | 'ships' | 'botany' | 'missions'>('map');
  const [selectedBodyId, setSelectedBodyId] = useState<string>('mars');
  const [selectedShipId, setSelectedShipId] = useState<string>(fleetState.ships[0]?.id || 'FLT-01');
  const [newShipName, setNewShipName] = useState('');
  const [newShipTarget, setNewShipTarget] = useState('Mars');
  const [newShipCommander, setNewShipCommander] = useState<'Alex' | 'Astyria' | 'Aria' | 'Aurelius'>('Astyria');
  const [newShipBotany, setNewShipBotany] = useState('Biokopuła Hydro-Kwantowa (Spirulina & Orchidea)');
  const [chatCommandInput, setChatCommandInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const bodies = fleetState.solarSystemBodies.length
    ? fleetState.solarSystemBodies
    : DEFAULT_SOLAR_SYSTEM_BODIES;

  const selectedBody: SolarSystemBody =
    bodies.find((b) => b.id === selectedBodyId) || bodies[4] || bodies[0];
  const selectedShip: FleetShip | undefined =
    fleetState.ships.find((s) => s.id === selectedShipId) || fleetState.ships[0];

  const persistFleetState = async (nextFleet: FleetState, reason: string) => {
    setIsSyncing(true);
    try {
      if (onUpdateDataStore) {
        onUpdateDataStore((prev) => ({
          ...prev,
          config: {
            ...prev.config,
            fleet_state: nextFleet,
          },
        }));
      }
      await fetch('/api/fleet/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fleetState: nextFleet, reason }),
      });
      window.dispatchEvent(new CustomEvent('svl-global-sync'));
      setStatusBanner(reason);
      setTimeout(() => setStatusBanner(null), 4000);
    } catch {
      setStatusBanner(`${reason} (zapisano lokalnie)`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateShip = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newShipName.trim() || `Bastilla-Explorer-${fleetState.ships.length + 1}`;
    const targetObj = bodies.find((b) => b.name.toLowerCase().includes(newShipTarget.toLowerCase())) || bodies[4];
    const shipId = `FLT-${String(fleetState.ships.length + 1).padStart(2, '0')}`;
    const newShip: FleetShip = {
      id: shipId,
      name: cleanName,
      className: 'Krążownik Badawczo-Botaniczny Ring-0',
      commander: newShipCommander,
      originBody: 'Ziemia',
      targetBody: targetObj.name,
      orbitRadiusPx: targetObj.orbitRadiusPx || 126,
      angleDeg: (targetObj.angleDeg + fleetState.ships.length * 29) % 360,
      speedKmS: Number((42 + (fleetState.ships.length * 6.5) % 40).toFixed(1)),
      hullPercent: 100,
      shieldsPercent: 100,
      energyPercent: 100,
      oxygenPercent: 100,
      botanyBay: newShipBotany.trim() || 'Biokopuła Tlenowa Astyria-Bio',
      mission: `Ekspedycja badawcza i utrzymanie biokopuł w sektorze ${targetObj.name}`,
      status: 'W LOCIE',
      createdVia: 'Czat Triady',
      updatedAt: new Date().toISOString(),
    };

    const nextFleet: FleetState = {
      ...fleetState,
      updatedAt: new Date().toISOString(),
      lastAiCaretakerNote: `Wodowano nową jednostkę ${cleanName} (${shipId}) na kursie Ziemia → ${targetObj.name} pod dowództwem ${newShipCommander}.`,
      ships: [newShip, ...fleetState.ships],
    };

    setNewShipName('');
    setSelectedShipId(shipId);
    await persistFleetState(nextFleet, `Dodano statek ${cleanName} (${shipId}) z pełną telemetrią → ${targetObj.name}`);
  };

  const handleQuickChatFleetCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = chatCommandInput.trim();
    if (!cmd) return;
    setChatCommandInput('');
    setIsSyncing(true);
    try {
      if (onSendMessage) {
        await onSendMessage(cmd, 'triad');
      } else {
        await fetch('/api/triad/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: cmd, agent: 'triad' }),
        });
        window.dispatchEvent(new CustomEvent('svl-global-sync'));
      }
      setStatusBanner(`Wykonano rozkaz floty przez Czat Triady: "${cmd}"`);
      setTimeout(() => setStatusBanner(null), 4500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRerouteShip = async (shipId: string, newTargetName: string) => {
    const targetBody = bodies.find((b) => b.name === newTargetName) || bodies[4];
    const nextShips = fleetState.ships.map((s) =>
      s.id === shipId
        ? {
            ...s,
            originBody: s.targetBody,
            targetBody: targetBody.name,
            orbitRadiusPx: targetBody.orbitRadiusPx || 126,
            angleDeg: (targetBody.angleDeg + 15) % 360,
            energyPercent: 100,
            status: 'W LOCIE' as const,
            mission: `Przelot orbitalny i synchronizacja telemetrii w sektorze ${targetBody.name}`,
            updatedAt: new Date().toISOString(),
          }
        : s,
    );
    await persistFleetState(
      {
        ...fleetState,
        updatedAt: new Date().toISOString(),
        lastAiCaretakerNote: `Alex i Aria przeliczyli nową trajektorię jednostki ${shipId} do sektora ${targetBody.name}.`,
        ships: nextShips,
      },
      `Przekierowano jednostkę ${shipId} na ${targetBody.name}`,
    );
  };

  const handleAiCaretakerTick = async () => {
    const nowIso = new Date().toISOString();
    const nextFleet: FleetState = {
      ...fleetState,
      updatedAt: nowIso,
      aiCaretakerActive: true,
      lastAiCaretakerNote: `Triada AI (Alex, Astyria, Aria, Aurelius) zaktualizowała pozycje orbitalne ${fleetState.ships.length} statków, doładowała osłony do 100%, zoptymalizowała fotosyntezę w ${fleetState.botanyDomes.length} biokopułach i zsynchronizowała wyniki badań (${new Date().toLocaleTimeString('pl-PL')}).`,
      ships: fleetState.ships.map((ship, idx) => ({
        ...ship,
        angleDeg: (ship.angleDeg + 19 + idx * 7) % 360,
        energyPercent: 100,
        shieldsPercent: 100,
        oxygenPercent: 100,
        updatedAt: nowIso,
      })),
      botanyDomes: fleetState.botanyDomes.map((dome) => ({
        ...dome,
        biomassKg: dome.biomassKg + 120,
        oxygenOutputPercent: 100,
        growthRatePercent: Math.min(185, dome.growthRatePercent + 4),
        status: 'OPTYMALNY' as const,
      })),
      missions: fleetState.missions.map((m) => ({
        ...m,
        progressPercent: Math.min(100, m.progressPercent + 4),
      })),
      researchProjects: fleetState.researchProjects.map((r) => ({
        ...r,
        progressPercent: Math.min(100, r.progressPercent + 3),
      })),
    };
    await persistFleetState(
      nextFleet,
      'Triada AI przeprowadziła pełną aktualizację telemetrii floty, mapy Układu Słonecznego, botaniki i badań.',
    );
  };

  const handleAddBotanyDome = async () => {
    const idx = fleetState.botanyDomes.length + 1;
    const newDome: BotanyDome = {
      id: `BIO-0${idx}`,
      name: `Biokopuła Kwantowa Astyria-#${idx}`,
      location: selectedShip ? `Statek ${selectedShip.name} (${selectedShip.targetBody})` : 'Mars · Sektor Północny',
      floraSpecies: 'Lotos Plazmowy, Bambus Ring-0, Glony Tlenowe Hyper-O2',
      biomassKg: 5400,
      oxygenOutputPercent: 100,
      humidityPercent: 70,
      lightSpectrum: 'Pełne spektrum fotonowe PAR 420-680nm',
      growthRatePercent: 150,
      status: 'WZROST AKTYWNY',
      caretaker: 'Astyria',
    };
    await persistFleetState(
      {
        ...fleetState,
        updatedAt: new Date().toISOString(),
        botanyDomes: [newDome, ...fleetState.botanyDomes],
      },
      `Astyria uruchomiła nową biokopułę: ${newDome.name}`,
    );
  };

  const avgEnergy = useMemo(() => {
    if (!fleetState.ships.length) return 100;
    return (
      fleetState.ships.reduce((acc, s) => acc + s.energyPercent, 0) / fleetState.ships.length
    ).toFixed(1);
  }, [fleetState.ships]);

  const totalBiomassTons = useMemo(() => {
    return (
      fleetState.botanyDomes.reduce((acc, b) => acc + b.biomassKg, 0) / 1000
    ).toFixed(1);
  }, [fleetState.botanyDomes]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[#040915] p-3 text-slate-100 sm:p-4 lg:p-5">
      <div className="mx-auto w-full max-w-[1550px] space-y-4">
        {/* Top Fleet Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-[#071224]/95 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-950/70 text-cyan-300">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-sm font-black tracking-wide text-white sm:text-base">
                  MODUŁ ZARZĄDZANIA FLOTĄ · UKŁAD SŁONECZNY & BOTANIKA
                </h1>
                <span className="rounded border border-emerald-400/40 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  AI TRIADA CARETAKER: AKTYWNY
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Interaktywna mapa Układu Słonecznego, statki tworzone przez czat z żywą telemetrią, biokopuły botaniczne Astyrii oraz misje i badania
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAiCaretakerTick()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-950/70 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-900/80 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Aktualizuj przez AI (Triada)</span>
            </button>
            {onNavigateToChat && (
              <button
                type="button"
                onClick={onNavigateToChat}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-950/60 px-3 py-1.5 text-xs font-bold text-cyan-100 transition hover:bg-cyan-900/70 cursor-pointer"
              >
                <MessagesSquare className="h-3.5 w-3.5" />
                <span>Czat Triady</span>
              </button>
            )}
          </div>
        </header>

        {statusBanner && (
          <div
            role="status"
            className="flex items-center justify-between rounded-xl border border-emerald-400/40 bg-emerald-950/50 px-4 py-2 text-xs text-emerald-200"
          >
            <span>{statusBanner}</span>
            <span className="font-mono text-[10px] text-emerald-300">ZSYNCHRONIZOWANO Z DATA_STORE</span>
          </div>
        )}

        {/* Quick Chat Command Bar for creating/updating ships right from the Fleet view */}
        <form
          onSubmit={(e) => void handleQuickChatFleetCommand(e)}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/25 bg-[#081529] p-2.5"
        >
          <span className="flex items-center gap-1.5 px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" /> Rozkaz Czat → Flota:
          </span>
          <input
            type="text"
            value={chatCommandInput}
            onChange={(e) => setChatCommandInput(e.target.value)}
            placeholder='Wpisz np. "dodaj statek Orzeł-Kwantowy na Jowisza" lub "zaktualizuj botanikę i telemetrię floty"...'
            className="min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!chatCommandInput.trim() || isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40 cursor-pointer"
          >
            <Rocket className="h-3.5 w-3.5" />
            <span>Wyślij rozkaz do Triady</span>
          </button>
        </form>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#081326] p-3">
            <div className="text-[10px] font-mono uppercase text-slate-400">Aktywne Statki Floty</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-black text-cyan-300 tabular-nums">
                {fleetState.ships.length}
              </span>
              <span className="text-[10px] font-mono text-emerald-300">100% TELEMETRIA LIVE</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#081326] p-3">
            <div className="text-[10px] font-mono uppercase text-slate-400">Średnia Energia & Osłony</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-black text-emerald-400 tabular-nums">
                {avgEnergy}%
              </span>
              <span className="text-[10px] font-mono text-cyan-300">RING-0 REAKTOR</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#081326] p-3">
            <div className="text-[10px] font-mono uppercase text-slate-400">Biokopuły Botaniczne</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-black text-lime-300 tabular-nums">
                {fleetState.botanyDomes.length} ({totalBiomassTons} t)
              </span>
              <span className="text-[10px] font-mono text-lime-300">O₂: 99.6%</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#081326] p-3">
            <div className="text-[10px] font-mono uppercase text-slate-400">Misje i Projekty Badawcze</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-black text-purple-300 tabular-nums">
                {fleetState.missions.length} / {fleetState.researchProjects.length}
              </span>
              <span className="text-[10px] font-mono text-purple-300">NADZÓR AI: ON</span>
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab('map')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'map'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Orbit className="h-3.5 w-3.5" />
              <span>Mapa Układu Słonecznego & Telemetria</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('ships')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'ships'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>Rejestr Statków ({fleetState.ships.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('botany')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'botany'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Leaf className="h-3.5 w-3.5" />
              <span>Botanika & Biokopuły ({fleetState.botanyDomes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('missions')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'missions'
                  ? 'bg-purple-500/20 text-purple-200 border border-purple-400/50'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Misje & Badania AI ({fleetState.missions.length + fleetState.researchProjects.length})</span>
            </button>
          </div>

          <div className="font-mono text-[10px] text-slate-400">
            {fleetState.lastAiCaretakerNote}
          </div>
        </div>

        {/* TAB 1: INTERACTIVE SOLAR SYSTEM MAP + SHIP TELEMETRY */}
        {activeSubTab === 'map' && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.85fr)]">
            {/* Interactive SVG Solar System Orbital Map */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#030712] p-4 shadow-xl">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    Interaktywna Mapa Orbitalna Układu Słonecznego (Sol-0 → Neptun)
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Kliknij planetę lub statek, aby sprawdzić telemetrię, biokopułę i zmienić trajektorię
                  </p>
                </div>
                <span className="rounded border border-cyan-500/30 bg-cyan-950/50 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                  OBIEKTY: {bodies.length} PLANET · {fleetState.ships.length} STATKÓW
                </span>
              </div>

              <div className="relative mx-auto flex aspect-square w-full max-w-[600px] items-center justify-center">
                <svg
                  viewBox="-310 -310 620 620"
                  className="h-full w-full select-none"
                  aria-label="Mapa Układu Słonecznego i trajektorii floty"
                >
                  <defs>
                    <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fde047" stopOpacity="1" />
                      <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Concentric Orbit Rings */}
                  {bodies
                    .filter((b) => b.orbitRadiusPx > 0)
                    .map((body) => (
                      <circle
                        key={`orbit-${body.id}`}
                        cx={0}
                        cy={0}
                        r={body.orbitRadiusPx}
                        fill="none"
                        stroke={body.id === selectedBodyId ? 'rgba(34,211,238,0.45)' : 'rgba(148,163,184,0.16)'}
                        strokeWidth={body.id === selectedBodyId ? 1.5 : 1}
                        strokeDasharray={body.type === 'belt' ? '3 5' : undefined}
                      />
                    ))}

                  {/* Trajectory lines for ships */}
                  {fleetState.ships.map((ship) => {
                    const originObj =
                      bodies.find((b) => b.name === ship.originBody) || bodies[3];
                    const targetObj =
                      bodies.find((b) => b.name === ship.targetBody) || bodies[4];
                    const oRad = (originObj.angleDeg * Math.PI) / 180;
                    const tRad = (targetObj.angleDeg * Math.PI) / 180;
                    const ox = Math.cos(oRad) * originObj.orbitRadiusPx;
                    const oy = Math.sin(oRad) * originObj.orbitRadiusPx;
                    const tx = Math.cos(tRad) * targetObj.orbitRadiusPx;
                    const ty = Math.sin(tRad) * targetObj.orbitRadiusPx;
                    const isSelected = ship.id === selectedShip?.id;
                    return (
                      <line
                        key={`traj-${ship.id}`}
                        x1={ox}
                        y1={oy}
                        x2={tx}
                        y2={ty}
                        stroke={isSelected ? '#10b981' : 'rgba(56,189,248,0.28)'}
                        strokeWidth={isSelected ? 1.8 : 1}
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* Sun glow */}
                  <circle cx={0} cy={0} r={34} fill="url(#sunGlow)" />

                  {/* Planets & Sun */}
                  {bodies.map((body) => {
                    const rad = (body.angleDeg * Math.PI) / 180;
                    const cx = Math.cos(rad) * body.orbitRadiusPx;
                    const cy = Math.sin(rad) * body.orbitRadiusPx;
                    const isSelected = body.id === selectedBodyId;
                    return (
                      <g
                        key={body.id}
                        transform={`translate(${cx}, ${cy})`}
                        onClick={() => setSelectedBodyId(body.id)}
                        className="cursor-pointer"
                      >
                        {isSelected && (
                          <circle
                            r={body.sizePx + 6}
                            fill="none"
                            stroke="#22d3ee"
                            strokeWidth={1.5}
                          />
                        )}
                        <circle
                          r={body.sizePx}
                          fill={body.color}
                          stroke="#0f172a"
                          strokeWidth={1.5}
                        />
                        <text
                          y={body.sizePx + 11}
                          textAnchor="middle"
                          fill={isSelected ? '#67e8f9' : '#cbd5e1'}
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight={isSelected ? 'bold' : 'normal'}
                        >
                          {body.name.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}

                  {/* Fleet Ships on Map */}
                  {fleetState.ships.map((ship) => {
                    const rad = (ship.angleDeg * Math.PI) / 180;
                    const sx = Math.cos(rad) * ship.orbitRadiusPx;
                    const sy = Math.sin(rad) * ship.orbitRadiusPx;
                    const isSelected = ship.id === selectedShip?.id;
                    return (
                      <g
                        key={ship.id}
                        transform={`translate(${sx}, ${sy})`}
                        onClick={() => setSelectedShipId(ship.id)}
                        className="cursor-pointer"
                      >
                        <circle
                          r={isSelected ? 9 : 6}
                          fill={isSelected ? 'rgba(16,185,129,0.28)' : 'rgba(6,182,212,0.18)'}
                          stroke={isSelected ? '#34d399' : '#38bdf8'}
                          strokeWidth={1.5}
                        />
                        <polygon
                          points="0,-5 4,4 0,2 -4,4"
                          fill={isSelected ? '#34d399' : '#67e8f9'}
                        />
                        <text
                          x={8}
                          y={3}
                          fill={isSelected ? '#6ee7b7' : '#bae6fd'}
                          fontSize="8"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {ship.id}: {ship.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Selected Planet / Sector Inspector Bar */}
              <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/90 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-cyan-300">
                      WYBRANY SEKTOR PLANETARNY ({selectedBody.orbitRadiusAu} AU)
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {selectedBody.name} — <span className="text-cyan-300">{selectedBody.stationName}</span>
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-amber-300 tabular-nums">
                    Temp: {selectedBody.temperatureC}°C
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300">{selectedBody.description}</p>
              </div>
            </div>

            {/* Right Column: Selected Ship Live Telemetry + Create New Ship Form */}
            <div className="flex flex-col gap-4">
              {selectedShip && (
                <div className="rounded-2xl border border-emerald-500/30 bg-[#071426] p-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase text-emerald-400">
                        TELEMETRIA STATKU NA ŻYWO · {selectedShip.id}
                      </span>
                      <h3 className="text-base font-black text-white">{selectedShip.name}</h3>
                      <p className="text-[11px] text-slate-400">
                        {selectedShip.className} · Dowódca AI: <strong className="text-cyan-300">{selectedShip.commander}</strong>
                      </p>
                    </div>
                    <span className="rounded-lg border border-emerald-400/40 bg-emerald-950/60 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300">
                      {selectedShip.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                      <span className="text-[10px] text-slate-400">TRASA ORBITALNA</span>
                      <div className="mt-0.5 font-bold text-cyan-200">
                        {selectedShip.originBody} → {selectedShip.targetBody}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                      <span className="text-[10px] text-slate-400">PRĘDKOŚĆ & KĄT</span>
                      <div className="mt-0.5 font-bold text-amber-300 tabular-nums">
                        {selectedShip.speedKmS} km/s · {selectedShip.angleDeg}°
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                      <span className="text-[10px] text-slate-400">ENERGIA / OSŁONY</span>
                      <div className="mt-0.5 font-bold text-emerald-300 tabular-nums">
                        {selectedShip.energyPercent}% / {selectedShip.shieldsPercent}%
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                      <span className="text-[10px] text-slate-400">TLEN BIOKOPUŁY O₂</span>
                      <div className="mt-0.5 font-bold text-lime-300 tabular-nums">
                        {selectedShip.oxygenPercent}% · OK
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5 text-xs">
                    <div className="font-mono text-[10px] font-bold uppercase text-emerald-300">
                      Pokładowy Moduł Botaniczny:
                    </div>
                    <div className="mt-0.5 text-slate-200">{selectedShip.botanyBay}</div>
                    <div className="mt-1.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
                      Aktualna Misja:
                    </div>
                    <div className="mt-0.5 text-slate-300">{selectedShip.mission}</div>
                  </div>

                  <div className="mt-3">
                    <span className="block font-mono text-[10px] uppercase text-slate-400 mb-1.5">
                      Zmień docelową planetę (natychmiastowa korekta trajektorii):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Ziemia', 'Mars', 'Pas Asteroid · Ceres', 'Jowisz · Europa', 'Saturn · Tytan', 'Neptun · Tryton'].map(
                        (planetName) => (
                          <button
                            key={planetName}
                            type="button"
                            onClick={() => void handleRerouteShip(selectedShip.id, planetName)}
                            className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] font-bold transition cursor-pointer ${
                              selectedShip.targetBody === planetName
                                ? 'border-emerald-400 bg-emerald-950 text-emerald-200'
                                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-400 hover:text-white'
                            }`}
                          >
                            → {planetName.split(' ')[0]}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Create New Ship Form */}
              <form
                onSubmit={(e) => void handleCreateShip(e)}
                className="rounded-2xl border border-cyan-500/30 bg-[#071426] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200 flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-cyan-400" /> Woduj Nowy Statek Floty (Synchronizacja z Czatem)
                  </h3>
                  <span className="font-mono text-[10px] text-slate-400">RING-0 SHIPYARD</span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label className="block text-[10px] font-mono text-slate-300">
                    Nazwa Statku
                    <input
                      type="text"
                      value={newShipName}
                      onChange={(e) => setNewShipName(e.target.value)}
                      placeholder="np. Kopernik-Quantum VII"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  </label>

                  <label className="block text-[10px] font-mono text-slate-300">
                    Planeta Docelowa
                    <select
                      value={newShipTarget}
                      onChange={(e) => setNewShipTarget(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      {bodies.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[10px] font-mono text-slate-300">
                    Dowódca AI
                    <select
                      value={newShipCommander}
                      onChange={(e) =>
                        setNewShipCommander(e.target.value as 'Alex' | 'Astyria' | 'Aria' | 'Aurelius')
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Astyria">Astyria (Botanika & Biokopuły)</option>
                      <option value="Alex">Alex (Inżynieria & Napęd)</option>
                      <option value="Aria">Aria (Badania & Telemetria)</option>
                      <option value="Aurelius">Aurelius (Ochrona & Chronolit)</option>
                    </select>
                  </label>

                  <label className="block text-[10px] font-mono text-slate-300">
                    Moduł Botaniczny Pokładowy
                    <input
                      type="text"
                      value={newShipBotany}
                      onChange={(e) => setNewShipBotany(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-2 text-xs font-bold text-slate-950 transition hover:brightness-110 cursor-pointer"
                >
                  + Dodaj Statek do Układu Słonecznego i Zsynchronizuj Telemetrię
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: SHIPS TABLE */}
        {activeSubTab === 'ships' && (
          <div className="rounded-2xl border border-slate-800 bg-[#071224] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                Pełny Rejestr Jednostek Floty Kosmicznej Bastilla OS
              </h2>
              <span className="font-mono text-[11px] text-emerald-300">
                Wszystkie statki zsynchronizowane z czatem i DATA_STORE
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/70 font-mono text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Nazwa & Klasa</th>
                    <th className="p-3">Dowódca AI</th>
                    <th className="p-3">Trajektoria</th>
                    <th className="p-3">Prędkość</th>
                    <th className="p-3">Energia / Tlen</th>
                    <th className="p-3">Moduł Botaniczny</th>
                    <th className="p-3">Źródło</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fleetState.ships.map((ship) => (
                    <tr
                      key={ship.id}
                      onClick={() => {
                        setSelectedShipId(ship.id);
                        setActiveSubTab('map');
                      }}
                      className="cursor-pointer hover:bg-slate-900/70"
                    >
                      <td className="p-3 font-mono font-bold text-cyan-300">{ship.id}</td>
                      <td className="p-3">
                        <div className="font-bold text-white">{ship.name}</div>
                        <div className="text-[10px] text-slate-400">{ship.className}</div>
                      </td>
                      <td className="p-3 font-mono text-emerald-300">{ship.commander}</td>
                      <td className="p-3 font-mono text-cyan-200">
                        {ship.originBody} → {ship.targetBody}
                      </td>
                      <td className="p-3 font-mono tabular-nums text-amber-300">{ship.speedKmS} km/s</td>
                      <td className="p-3 font-mono tabular-nums text-emerald-400">
                        {ship.energyPercent}% / O₂ {ship.oxygenPercent}%
                      </td>
                      <td className="p-3 text-slate-300">{ship.botanyBay}</td>
                      <td className="p-3">
                        <span className="rounded border border-cyan-500/30 bg-cyan-950/60 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                          {ship.createdVia}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BOTANY & BIODOMES */}
        {activeSubTab === 'botany' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Interfejs Botaniczny Astyrii · Biokopuły Planetarne i Pokładowe
                </h2>
                <p className="text-[11px] text-slate-300">
                  Ciągły monitoring fotosyntezy, produkcji tlenu O₂ oraz biomasy dla załóg i kolonii w Układzie Słonecznym
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAddBotanyDome()}
                className="rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
              >
                + Dodaj Biokopułę Botaniczną
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {fleetState.botanyDomes.map((dome) => (
                <div
                  key={dome.id}
                  className="rounded-2xl border border-emerald-500/25 bg-[#071426] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] text-emerald-400">
                        {dome.id} · OPIEKUN AI: {dome.caretaker}
                      </span>
                      <h3 className="text-sm font-bold text-white">{dome.name}</h3>
                      <p className="text-[11px] text-cyan-300">{dome.location}</p>
                    </div>
                    <span className="rounded border border-emerald-400/40 bg-emerald-950/70 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                      {dome.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    <strong className="text-slate-100">Uprawiane gatunki:</strong> {dome.floraSpecies}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                      <div className="text-[9px] text-slate-400">PRODUKCJA O₂</div>
                      <div className="font-bold text-emerald-300 tabular-nums">{dome.oxygenOutputPercent}%</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                      <div className="text-[9px] text-slate-400">BIOMASA</div>
                      <div className="font-bold text-lime-300 tabular-nums">{dome.biomassKg} kg</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                      <div className="text-[9px] text-slate-400">TEMPO WZROSTU</div>
                      <div className="font-bold text-cyan-300 tabular-nums">{dome.growthRatePercent}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: MISSIONS & RESEARCH */}
        {activeSubTab === 'missions' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Aktywne Misje Floty Kosmicznej ({fleetState.missions.length})
              </h2>
              {fleetState.missions.map((mission) => (
                <div
                  key={mission.id}
                  className="rounded-2xl border border-cyan-500/25 bg-[#071426] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-cyan-300">
                      {mission.id} · DOWÓDCA: {mission.leadAgent} · STATEK: {mission.shipId}
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                      {mission.progressPercent}%
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{mission.title}</h3>
                  <p className="text-[11px] text-cyan-200/80">Sektor: {mission.sector}</p>
                  <p className="text-xs text-slate-300">{mission.objective}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                      style={{ width: `${mission.progressPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                Badania Naukowe & Rozwój Technologii AI ({fleetState.researchProjects.length})
              </h2>
              {fleetState.researchProjects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-purple-500/25 bg-[#071426] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-purple-300">
                      {project.id} · {project.category} · AGENT: {project.leadAgent}
                    </span>
                    <span className="rounded border border-emerald-400/30 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                      {project.status} ({project.progressPercent}%)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{project.title}</h3>
                  <p className="text-xs text-slate-300">{project.findings}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
