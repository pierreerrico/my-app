import {
    DerivedMapGeometry,
} from "../../data/maps/types";
import {
    formatCoordinate,
    valuesWithinBounds,
} from "../../data/maps/geography";

export function MapGrid({ geometry }: { geometry: DerivedMapGeometry }) {
    const longitudes = valuesWithinBounds(
        geometry.bounds.west,
        geometry.bounds.east,
        1,
    );
    const latitudes = valuesWithinBounds(
        geometry.bounds.south,
        geometry.bounds.north,
        1,
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
            <defs>
                <filter
                    id="coordinate-label-halo"
                    x="-80%"
                    y="-160%"
                    width="260%"
                    height="420%"
                    colorInterpolationFilters="sRGB"
                >
                    <feMorphology
                        in="SourceAlpha"
                        operator="dilate"
                        radius="5"
                        result="expanded"
                    />
                    <feGaussianBlur
                        in="expanded"
                        stdDeviation="5"
                        result="blurred"
                    />
                    <feFlood
                        floodColor="#cdbb98"
                        floodOpacity=".72"
                        result="haloColor"
                    />
                    <feComposite
                        in="haloColor"
                        in2="blurred"
                        operator="in"
                        result="halo"
                    />
                    <feMerge>
                        <feMergeNode in="halo" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

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

            <g
                className="grid-labels"
                filter="url(#coordinate-label-halo)"
            >
                {longitudes.map((longitude) => {
                    const x = xForLongitude(longitude);
                    return (
                        <text x={x} y="608" textAnchor="middle" key={`lon-label-${longitude}`}>
                            {formatCoordinate(longitude, "longitude")}
                        </text>
                    );
                })}
                {latitudes.map((latitude) => {
                    const y = yForLatitude(latitude);
                    return (
                        <text
                            x="985"
                            y={y + 4}
                            textAnchor="end"
                            key={`lat-label-${latitude}`}
                        >
                            {formatCoordinate(latitude, "latitude")}
                        </text>
                    );
                })}
            </g>
        </svg>
    );
}
