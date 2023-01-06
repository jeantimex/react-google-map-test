/*
 * Copyright 2021 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { createCustomEqual } from "fast-equals";
import { isLatLngLiteral } from "@googlemaps/typescript-guards";

import data1 from './testdata1.js';
import data2 from './testdata2.js';

const render = (status: Status) => {
  return <h1>{status}</h1>;
};

const App: React.VFC = () => {
  const [clicks, setClicks] = React.useState<google.maps.LatLng[]>([]);
  const [zoom, setZoom] = React.useState(3); // initial zoom
  const [center, setCenter] = React.useState<google.maps.LatLngLiteral>({
    lat: 0,
    lng: 0,
  });
  const [mapData, setMapData] = React.useState([]);

  const onClick = (e: google.maps.MapMouseEvent) => {
    console.log('map click')
    // avoid directly mutating state
    setClicks([...clicks, e.latLng!]);
  };

  const onDBClick = (e: google.maps.MapMouseEvent) => {
    console.log('map db click')
    console.log(111, e)
    e.stop();
  }

  const onIdle = (m: google.maps.Map) => {
    console.log("onIdle", data1);
    setMapData(new Date().getTime() % 2 === 0 ? data1 : data2)
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Wrapper apiKey='YOUR KEY' libraries={['marker']} version='beta' render={render}>
        <Map
          center={center}
          onClick={onClick}
          onDBClick={onDBClick}
          onIdle={onIdle}
          zoom={zoom}
          style={{ flexGrow: "1", height: "100%" }}
          
        >
        {mapData?.map((item) => (
          <Marker
            key={`text-${item.diffId}`}
            data={item}
            position={{
              lat: item.location.lat,
              lng: item.location.lon,
            }}
          />
        ))}
        </Map>
      </Wrapper>
    </div>
  );
};
interface MapProps extends google.maps.MapOptions {
  style: { [key: string]: string };
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onDBClick?: (e: google.maps.MapMouseEvent) => void;
  onIdle?: (map: google.maps.Map) => void;
  children?: React.ReactNode;
}

const Map: React.FC<MapProps> = ({
  onClick,
  onDBClick,
  onIdle,
  children,
  style,
  ...options
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [map, setMap] = React.useState<google.maps.Map>();

  React.useEffect(() => {
    if (ref.current && !map) {
      setMap(new window.google.maps.Map(ref.current, {
        mapId: 'e489a9cc5e3c637b',
        clickableIcons: false,
      }));
    }
  }, [ref, map]);

  // because React does not do deep comparisons, a custom hook is used
  // see discussion in https://github.com/googlemaps/js-samples/issues/946
  useDeepCompareEffectForMaps(() => {
    if (map) {
      map.setOptions(options);
    }
  }, [map, options]);

  React.useEffect(() => {
    if (map) {
      ["click", "idle", 'dblclick'].forEach((eventName) =>
        google.maps.event.clearListeners(map, eventName)
      );

      if (onClick) {
        map.addListener("click", onClick);
      }

      if (onDBClick) {
        map.addListener("dblclick", onDBClick);
      }

      if (onIdle) {
        map.addListener("idle", () => onIdle(map));
      }
    }
  }, [map, onClick, onIdle, onDBClick]);

  return (
    <>
      <div ref={ref} style={style} />
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // set the map prop on the child component
          // @ts-ignore
          return React.cloneElement(child, { map });
        }
      })}
    </>
  );
};

const Marker: React.FC<google.maps.MarkerOptions> = (options) => {
  const [marker, setMarker] = React.useState();

  React.useEffect(() => {
		if (!marker) {
			const { map, position, data } = options;
			const { title, subTitle, hideText, textIndex } = data;

			if (!title || hideText) {
				return;
			}

			const content = document.createElement('div');
			content.className = 'markerTitle';
			const titleSpan = document.createElement('span');
			titleSpan.className = 'main';
			titleSpan.textContent = title;
			content.appendChild(titleSpan);
			if (subTitle) {
				const subTitleSpan = document.createElement('span');
				subTitleSpan.className = 'sub';
				subTitleSpan.textContent = subTitle;
				content.appendChild(subTitleSpan);
			}

			const curTextMarkerView =
				new window.google.maps.marker.AdvancedMarkerView({
					map,
					position,
					content,
					zIndex: textIndex,
					collisionBehavior:
						window.google.maps.CollisionBehavior
							.OPTIONAL_AND_HIDES_LOWER_PRIORITY,
				});

			curTextMarkerView.addListener('click', () => {
				onClick?.(data);
			});

			setMarker(curTextMarkerView);
		}

		return () => {
			if (marker) {
				marker.map = null;
			}
		};
	}, [marker]);

	return null;
};

const deepCompareEqualsForMaps = createCustomEqual(
  (deepEqual) => (a: any, b: any) => {
    if (
      isLatLngLiteral(a) ||
      a instanceof google.maps.LatLng ||
      isLatLngLiteral(b) ||
      b instanceof google.maps.LatLng
    ) {
      return new google.maps.LatLng(a).equals(new google.maps.LatLng(b));
    }

    // TODO extend to other types

    // use fast-equals for other objects
    return deepEqual(a, b);
  }
);

function useDeepCompareMemoize(value: any) {
  const ref = React.useRef();

  if (!deepCompareEqualsForMaps(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

function useDeepCompareEffectForMaps(
  callback: React.EffectCallback,
  dependencies: any[]
) {
  React.useEffect(callback, dependencies.map(useDeepCompareMemoize));
}

window.addEventListener("DOMContentLoaded", () => {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
});


export {};
