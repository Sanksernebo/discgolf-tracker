"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

export default function CourseMiniMapInner({
  lat,
  lng,
  name,
}: {
  lat: number;
  lng: number;
  name: string;
}) {
  return (
    <div className="h-48 w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OSM'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[lat, lng]}
          radius={12}
          pathOptions={{
            color: "#10b981",
            weight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.6,
          }}
        >
          <Popup>{name}</Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
