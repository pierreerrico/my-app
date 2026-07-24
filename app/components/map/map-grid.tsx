import {
    DerivedMapGeometry,
} from "../../data/maps/types";
import {
    chooseNiceStep,
    formatCoordinate,
    valuesWithinBounds,
} from "../../data/maps/geography";

export function MapGrid({ geometry }: { geometry: DerivedMapGeometry }) {
    const longitudeStep = chooseNiceStep(geometry.longitudeSpanDegrees, 5);
    const latitudeStep = chooseNiceStep(geometry.latitudeSpanDegrees, 5);
    const longitudes = valuesWithinBounds(
        geometry.bounds.west,
        geometry.bounds.east,
        longitudeStep,
    );
    const latitudes = valuesWithinBounds(
        geometry.bounds.south,
        geometry.bounds.north,
        latitudeStep,
    );

    const xForLongitude = (longitude: number) =>
        ((longitude - geometry.bounds.west) /
            (geometry.bounds.east - geometry.bounds.west)) *
        1000;
    const yForLatitude = (latitude: number) =>
        ((geometry.bounds.north - latitude) /
            (geometry.bounds.north - geometry.bounds.south)) *
        620;

    return (
        <svg
            className="coordinate-grid"
            viewBox="0 0 1000 620"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <g className="grid-lines">
                {longitudes.map((longitude) => {
                    const x = xForLongitude(longitude);
                    return <line x1={x} y1="0" x2={x} y2="620" key={`lon-${longitude}`} />;
                })}
                {latitudes.map((latitude) => {
                    const y = yForLatitude(latitude);
                    return <line x1="0" y1={y} x2="1000" y2={y} key={`lat-${latitude}`} />;
                })}
            </g>

            <g className="grid-labels">
                {longitudes.map((longitude) => {
                    const x = xForLongitude(longitude);
                    return (
                        <text x={x} y="582" textAnchor="middle" key={`lon-label-${longitude}`}>
                            {formatCoordinate(longitude, "longitude")}
                        </text>
                    );
                })}
                {latitudes.map((latitude) => {
                    const y = yForLatitude(latitude);
                    return (
                        <text x="902" y={y + 4} key={`lat-label-${latitude}`}>
                            {formatCoordinate(latitude, "latitude")}
                        </text>
                    );
                })}
            </g>
        </svg>
    );
}