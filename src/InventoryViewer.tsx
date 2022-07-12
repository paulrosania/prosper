import { useContext, useMemo, useState } from 'react';

import {
  FioClient,
  StationRepository,
  Store,
  StorageRepository,
  UserShips,
  UserSites,
  UserStorage,
} from './data';
import { OrderBookContext } from './contexts/OrderBookContext';

function formatCurrency(amount: number, currency: string): string {
  const value = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} ${currency}`;
}

const client = new FioClient();
const stations = StationRepository.default();

interface StorageLocationProps {
  store: Store;
}

interface MaterialProps {
  ticker?: string;
  name?: string;
  type: string;
  quantity: number;
  weight: number;
  volume: number;
}

function Material({ ticker, quantity }: MaterialProps) {
  const orderBook = useContext(OrderBookContext);
  let cx;
  if (orderBook) {
    cx = orderBook.find(
      (m) => m.MaterialTicker === ticker && m.ExchangeCode === 'IC1'
    );
  }

  return (
    <tr>
      <td className="text-right">{quantity}</td>
      <td>{ticker}</td>
      <td className="text-right">
        {cx && formatCurrency(cx.PriceAverage ?? 0, cx.Currency)}
      </td>
      <td className="text-right">
        {cx && formatCurrency(quantity * (cx.PriceAverage ?? 0), cx.Currency)}
      </td>
    </tr>
  );
}

interface OtherProps {
  type: string;
}

function Other({ type }: OtherProps) {
  return (
    <tr>
      <td colSpan={4}>{type}</td>
    </tr>
  );
}

function StorageLocation({ store }: StorageLocationProps) {
  return (
    <div>
      <table className="table bg-base-200">
        <thead>
          <tr>
            <th>Qty</th>
            <th>Mat.</th>
            <th className="text-center">Price</th>
            <th className="text-center">Value</th>
          </tr>
        </thead>
        <tbody>
          {store.items.map((material) => {
            if (material.type === 'material') {
              return (
                <Material
                  key={material.id}
                  ticker={material.ticker}
                  name={material.name}
                  type={material.type}
                  quantity={material.quantity}
                  weight={material.totalWeight}
                  volume={material.totalVolume}
                />
              );
            } else {
              return <Other type={material.type} />;
            }
          })}
        </tbody>
      </table>
    </div>
  );
}

interface FuelTankProps {
  type: 'ftl' | 'stl';
  tank: Store;
}

function FuelTank({ type, tank }: FuelTankProps) {
  const pct = (100 * tank.volume.used) / tank.volume.capacity;
  return (
    <div className="flex items-center space-x-1">
      <div className="font-bold">{type.toUpperCase()}</div>
      <progress className="progress w-40" value={pct} max="100"></progress>
    </div>
  );
}

interface ShipInventoryProps {
  ship: UserShips[number];
  hold?: Store | null;
  ftlTank?: Store | null;
  stlTank?: Store | null;
}

function ShipInventory({ ship, hold, ftlTank, stlTank }: ShipInventoryProps) {
  return (
    <div>
      <div className="my-2 font-bold">🚀 {ship.Name}</div>
      {stlTank && <FuelTank type="stl" tank={stlTank} />}
      {ftlTank && <FuelTank type="ftl" tank={ftlTank} />}
      {hold && <StorageLocation store={hold} />}
    </div>
  );
}

interface SiteInventoryProps {
  site: UserSites[number];
  stores: Store[];
}

function SiteInventory({ site, stores }: SiteInventoryProps) {
  return (
    <div>
      <div className="my-2 font-bold">🪐 {site.PlanetName}</div>
      {stores.length > 0 && <StorageLocation store={stores[0]} />}
    </div>
  );
}

interface WarehouseProps {
  inventory: Store;
}

function Warehouse({ inventory }: WarehouseProps) {
  const station = stations.findByWarehouseId(inventory.parentId);
  const displayName = station
    ? `${station.name} (${station.system.code})`
    : inventory.parentId;

  return (
    <div>
      <div className="my-2 font-bold">📦 {displayName}</div>
      <StorageLocation store={inventory} />
    </div>
  );
}

export default function InventoryViewer() {
  const [inventory, setInventory] = useState<UserStorage>([]);
  const [ships, setShips] = useState<UserShips>([]);
  const [sites, setSites] = useState<UserSites>([]);
  useMemo(() => {
    client.getUserStorage().then((inv) => setInventory(inv));
  }, []);
  useMemo(() => {
    client.getUserShips().then((ships) => setShips(ships));
  }, []);
  useMemo(() => {
    client.getUserSites().then((sites) => setSites(sites));
  }, []);

  const storage = StorageRepository.fromFio(inventory);

  return (
    <div className="pt-20 p-4">
      <div className="flex space-x-4">
        {ships.map((ship) => (
          <ShipInventory
            key={ship.ShipId}
            ship={ship}
            hold={storage.findById(ship.StoreId)}
            ftlTank={storage.findById(ship.FtlFuelStoreId)}
            stlTank={storage.findById(ship.StlFuelStoreId)}
          />
        ))}
      </div>
      <div className="flex space-x-4">
        {sites.map((site) => (
          <SiteInventory
            key={site.SiteId}
            site={site}
            stores={storage.findByParentId(site.SiteId)}
          />
        ))}
      </div>
      <div className="flex space-x-4">
        {storage.findByType('warehouse').map((wh) => (
          <Warehouse key={wh.id} inventory={wh} />
        ))}
      </div>
    </div>
  );
}
