"use client";
import { useEffect, useState } from "react";
import { Knob } from "primereact/knob";
import { ToggleButton, ToggleButtonChangeEvent } from "primereact/togglebutton";

export default function Home() {
  const [valueIP, setValueIP] = useState("");
  const [ip, setIP] = useState("");
  const [temp, setTemp] = useState(23);
  const [timer, setTimer] = useState(false);
  const [light, setLight] = useState(false);
  const [fan, setFan] = useState(false);

  useEffect(() => {
    console.log({ temp, timer, light, fan });
  }, [temp, timer, light, fan]);
  return (
    <>
      {(ip && (
        <main className="grid place-items-center h-screen p-0 lg:p-32">
          <div className="grid h-full w-full backdrop-blur-xl border rounded-none lg:rounded-2xl p-2 bg-black/10">
            <div className="grid w-full gap-2">
              <div className="grid place-items-center p-4 bg-black/10 w-full rounded-xl">
                <Knob
                  value={temp}
                  onChange={(e) => setTemp(e.value)}
                  min={19}
                  max={26}
                  strokeWidth={4}
                />
                <p className="text-center text-black font-bold">AC control</p>
              </div>
              <div className="p-4 w-full bg-black/10 rounded-xl grid grid-cols-2">
                <div className="py-2">
                  <ToggleButton
                    checked={timer}
                    onChange={(e: ToggleButtonChangeEvent) => setTimer(e.value)}
                    offLabel="Timer off"
                    onLabel="Timer on"
                  />
                </div>
              </div>
              <div className="p-4 w-full bg-black/10 rounded-xl ">
                <div className="py-2">
                  <ToggleButton
                    checked={fan}
                    onChange={(e: ToggleButtonChangeEvent) => setFan(e.value)}
                    offLabel="Fan off"
                    onLabel="Fan on"
                  />
                </div>
                <div className="py-2">
                  <ToggleButton
                    checked={light}
                    onChange={(e: ToggleButtonChangeEvent) => setLight(e.value)}
                    offLabel="Light off"
                    onLabel="Light on"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      )) || (
        <div className="grid place-items-center h-screen p-0 lg:p-32">
          <div className="grid h-full w-full backdrop-blur-xl border rounded-none lg:rounded-2xl p-2 bg-black/10">
            <div className="grid w-full gap-2 place-items-center">
              <div className="p-4 bg-black/10 w-fit rounded-xl h-fit">
                <input
                  type="text"
                  placeholder="Enter IP address"
                  value={valueIP}
                  onChange={(e) => setValueIP(e.target.value)}
                  className="p-2 border rounded text-black"
                />
                <button
                  onClick={() => setIP(valueIP)}
                  className="p-2 bg-black/20 rounded-md"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
