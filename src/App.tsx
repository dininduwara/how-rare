// @ts-nocheck
import { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import AsyncSelect from 'react-select/async';
import { LineChart } from '@mui/x-charts/LineChart';
import {PieChart} from "@mui/x-charts";
import queryString from 'query-string';

//Results from https://data.gov.au/data/api/action/datastore_search_sql?sql=SELECT%20DISTINCT%20make,%20model%20from%20%2236b9bb45-f0bd-4069-89ac-f43d3f24a689%22 saved locally to prevent unnecessary queries to data.gov.au
import * as makeModelList from './assets/mm-list.json';
import useWindowDimensions from "./useWindowDimensions.ts";

export default function App() {
  const { height, width } = useWindowDimensions();
  const parsed = queryString.parse(location.search);

  const datasets = { '2024': "\"2c35ff3d-1f49-4721-b79c-d0f35b2c4d04\"", '2023': "\"6f375468-5ab0-4bba-8d0a-32df267c2dbd\"", '2022': "\"e6588c5f-e65f-4a6a-99d1-fde1b7ea5201\"", '2021': "\"21619e31-c57d-4845-a9d4-24cd172f446d\""};
  const baseQuery = 'https://data.gov.au/data/api/action/datastore_search_sql';
  const baseSelection = 'SELECT state_abb, year_of_manufacture, make, model, no_vehicles FROM ';
  const sumSelection = 'SELECT no_vehicles FROM ';

  const [results, setResults] = useState([{"label":"ACT", "value":0}, {"label":"NSW", "value":0}, {"label":"NT", "value":0}, {"label":"QLD", "value":0}, {"label":"SA", "value":0}, {"label":"TAS", "value":0}, {"label":"VIC", "value":0}, {"label":"WA", "value":0}]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsByYear, setResultsByYear] = useState([]);
  const [resultsChangeByDataset, setResultsChangeByDataset] = useState([]);

  const [selectedDataset, setSelectedDataset] = useState(parsed.dataset ?? '2024');
  const [selectedOption, setSelectedOption] = useState({make: parsed.make ?? null, model: parsed.model ?? null, label: parsed.make && parsed.model ? parsed.make + ' ' + parsed.model : 'Search Vehicles'});
  const [filterMYMin, setFilterMYMin] = useState(parsed.MYMin ?? '');
  const [filterMYMax, setFilterMYMax] = useState(parsed.MYMax ?? '');
  const [links, setLinks] = useState({source: '#', share: '#'});
  const [options] = useState(makeModelList.result.records.map(item => ({ make: item.make, model: item.model, label: item.make + ' ' + item.model})));

  useEffect(() => {
    if (selectedOption.make && selectedOption.model){

      //Query for detailed results
      let url = ' WHERE make=\''+selectedOption.make+'\' AND model=\''+selectedOption.model+'\''
      if (filterMYMin && filterMYMin.trim() != "")
        url = url + ' AND year_of_manufacture>=\''+filterMYMin+'\'';
      if (filterMYMax && filterMYMax.trim() != "")
        url = url + ' AND year_of_manufacture<=\''+filterMYMax+'\'';

      //Set local params
      const shareUrl = queryString.stringifyUrl({url: '/', query: { make: selectedOption.make, model: selectedOption.model, MYMin: filterMYMin, MYMax: filterMYMax, dataset: selectedDataset}});
      window.history.pushState(null, "How Rare", shareUrl);

      const detailedUrl = queryString.stringifyUrl({url: baseQuery, query: {sql: baseSelection + datasets[selectedDataset] + url}});
      setLinks({source: detailedUrl, share: shareUrl});
      axios.get(detailedUrl)
          .then(response => {
            const states = new Map([["ACT", 0], ["NSW", 0], ["NT", 0], ["QLD", 0], ["SA", 0], ["TAS", 0], ["VIC", 0], ["WA", 0]]);
            const years = new Map();
            let total = 0;
            response.data.result.records.forEach(function (value) {
              total += +value.no_vehicles;
              states.set(value.state_abb.toUpperCase(), states.get(value.state_abb.toUpperCase()) + +value.no_vehicles);
              years.set(value.year_of_manufacture, (years.get(value.year_of_manufacture) ?? 0) + (+value.no_vehicles));
            });
            setResultsByYear((Array.from(years, ([name, value]) => ({ name, value }))).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

            setResults((Array.from(states, ([label, value]) => ({ label, value }))).sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

            setResultsTotal(total);
          })
          .catch(error => {
            console.error(error);
          });

      //Query for change in total registrations in available datasets
      axios.all([
        axios.get(queryString.stringifyUrl({url: baseQuery, query: {sql: sumSelection + datasets['2024'] + url}})),
        axios.get(queryString.stringifyUrl({url: baseQuery, query: {sql: sumSelection + datasets['2023'] + url}})),
        axios.get(queryString.stringifyUrl({url: baseQuery, query: {sql: sumSelection + datasets['2022'] + url}})),
        axios.get(queryString.stringifyUrl({url: baseQuery, query: {sql: sumSelection + datasets['2021'] + url}})),
      ]).then(axios.spread((data2024, data2023, data2022, data2021) => {
        const years = new Map();
        data2024.data.result.records.forEach(function (value) {
          years.set('2024', (years.get('2024') ?? 0) + (+value.no_vehicles));
        });
        data2023.data.result.records.forEach(function (value) {
          years.set('2023', (years.get('2023') ?? 0) + (+value.no_vehicles));
        });
        data2022.data.result.records.forEach(function (value) {
          years.set('2022', (years.get('2022') ?? 0) + (+value.no_vehicles));
        });
        data2021.data.result.records.forEach(function (value) {
          years.set('2021', (years.get('2021') ?? 0) + (+value.no_vehicles));
        });
        setResultsChangeByDataset((Array.from(years, ([name, value]) => ({ name, value }))).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      }));
    }
  }, [selectedOption, filterMYMin, filterMYMax, selectedDataset]);

  const filterMakeModel = (inputValue: string) => {
    if (inputValue)
      return options.filter((i) =>
          i.label.toLowerCase().includes(inputValue.toLowerCase())
      );
    else
      return [];
  };

  const loadOptions = (
      inputValue: string,
      callback: (options: never) => void
  ) => {
    setTimeout(() => {
      callback(filterMakeModel(inputValue));
    }, 500);
  };

  const handleChange = (value) => {
    setSelectedOption(value);
  };

  const customStyles = {
    control: (base) => ({
      ...base,
      boxShadow: "none",
      border: "none",
    })
  };

  return (
      <>
        <div className='flex flex-col gap-6 justify-center items-center min-h-screen py-10'>
          <a className='text-4xl xl:text-5xl text-center font-black text-violet-700 hover:scale-101 transition ease-in-out delay-50 duration-200 uppercase font-display' href='/'>How rare is my car?</a>
          <p className='text-center w-full text-gray-800 font-medium text-sm xl:text-[0.96rem]'>
            An interface to query and visualise the Road vehicles Australia data, hosted on <a href="https://data.gov.au/home" target='_blank' className='text-blue-600'>data.gov.au</a>. <br/> Find out how many examples of your favourite car/motorbike/truck/etc are still registered in Australia.
          </p>
          <div className='flex flex-col gap-4 text-black'>
            <div className='flex flex-wrap gap-x-4 gap-y-1 xl:justify-center items-center'>
              <p>
                Dataset :
              </p>
              <label>
                <input type="radio" name="myRadio" value="2024" checked={selectedDataset == '2024'} onChange={e => setSelectedDataset(e.target.value)}  className='mr-1'/>
                2024 <a href='#rd2024' className='text-xs'>[4]</a>
              </label>
              <label>
                <input type="radio" name="myRadio" value="2023" checked={selectedDataset == '2023'}
                       onChange={e => setSelectedDataset(e.target.value)} className='mr-1'/>
                2023 <a href='#rd2023' className='text-xs'>[3]</a>
              </label>
              <label>
                <input type="radio" name="myRadio" value="2022" checked={selectedDataset == '2022'}
                       onChange={e => setSelectedDataset(e.target.value)} className='mr-1'/>
                2022 <a href='#rd2022' className='text-xs'>[2]</a>
              </label>
              <label>
                <input type="radio" name="myRadio" value="2021" checked={selectedDataset == '2021'}
                       onChange={e => setSelectedDataset(e.target.value)} className='mr-1'/>
                2021 <a href='#rd2021' className='text-xs'>[1]</a>
              </label>
            </div>
            <AsyncSelect cacheOptions loadOptions={loadOptions} defaultValue={selectedOption} defaultOptions onChange={handleChange}
                         styles={customStyles} classNames={{
              control: () => 'rounded-sm p-1.5 border-none shadow-none',
              container: () => 'border-2 border-slate-200 rounded-sm'
            }}
            />
            <div className='flex flex-row gap-2 justify-center items-center'>
              <input className='text-black placeholder-black p-3 rounded-sm border-2 border-slate-200 w-full' type="number" name="myMin" value={filterMYMin} onChange={e => setFilterMYMin(e.target.value)} placeholder='Model Year (MIN)'/>
              <input className='text-black placeholder-black p-3 rounded-sm border-2 border-slate-200 w-full' type="number" name="myMax" value={filterMYMax} onChange={e => setFilterMYMax(e.target.value)} placeholder='Model Year (MAX)'/>
            </div>
          </div>
          <div className='flex flex-row justify-center w-full text-center text-lg gap-2'>
            <p>Showing results for</p>
            {
              links.share != '#' ?
                  <div className='flex gap-2 items-center'>
                    <a href={links.share} target='_blank'
                       className='underline text-violet-600 hover:text-violet-700'>
                      {selectedOption.label}
                    </a>
                    <a href={links.source} target='_blank' className='underline text-sm text-violet-600 hover:text-violet-700 hover:cursor-pointer'>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                           stroke="currentColor" className="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
                      </svg>
                    </a>
                  </div>
                  : '...nothing'
            }
          </div>
          <div className='flex flex-col gap-5 w-full'>

            <div className='xl:text-lg -mb-3 flex flex-col xl:flex-row justify-between xl:items-center font-medium'>
              <h1 className='font-display uppercase text-gray-800 font-semibold'>
                Breakdown by State (with total)
              </h1>
              <p className='xl:text-right text-xs text-gray-600'>
                *As of 31 January, {selectedDataset}.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className='w-full rounded-sm border-2 border-violet-700'>
                <div className='hidden xl:flex '>
                  <table className="w-full text-sm text-center">
                    <thead className="text-sm uppercase">
                    <tr>
                      <th scope="col" className="px-6 py-3 bg-violet-700 text-white">
                        ACT
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-600 text-white">
                        NSW
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-700 text-white">
                        NT
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-600 text-white">
                        QLD
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-700 text-white">
                        SA
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-600 text-white">
                        TAS
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-700 text-white">
                        VIC
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-600 text-white">
                        WA
                      </th>
                      <th scope="col" className="px-6 py-3 bg-violet-700 text-white">
                        TOTAL
                      </th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                      {
                        results.map(item =>
                            <td key={item.label + 'D'} className="px-6 py-4 odd:bg-slate-100">
                              {item.value}
                            </td>
                        )
                      }
                      <td className="px-6 py-4 bg-slate-100 font-bold">
                        {resultsTotal}
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
                <div className='flex xl:hidden'>
                  <div className='w-full'>
                    {
                      results.map(item =>
                          <div key={item.label + 'M'} className="col-span-2 grid grid-cols-2 items-center odd: bg-violet-600 even:bg-violet-700 group">
                            <div className="px-6 py-2 text-white font-bold text-center">
                              {item.label}
                            </div>
                            <div className="px-6 py-2 text-center group-odd:bg-white group-even:bg-slate-100 ">
                              {item.value}
                            </div>
                          </div>
                      )
                    }
                    <div className="grid grid-cols-2 font-bold bg-violet-600">
                      <div className="px-6 py-2 text-white text-center">
                        TOTAL
                      </div>
                      <div className="px-6 py-2 text-center bg-white">
                        {resultsTotal}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                  className='flex justify-center items-center w-full border-2 border-violet-700 bg-slate-100 rounded-sm '>
                <PieChart
                    colors={['#F87171', '#60A5FA', '#E879F9', '#A3E635', '#FBBF24', '#34D399', '#A78BFA', '#22D3EE']}
                    sx={{'&&': {touchAction: 'auto'}}}
                    series={[
                      {
                        data: results,
                        highlightScope: {fade: 'global', highlight: 'item'},
                        faded: {innerRadius: 30, additionalRadius: -30, color: 'gray'},
                      },
                    ]}
                    width={width < 600 ? (width * 0.8) : 672}
                    height={width < 600 ? (width * 0.7) : 200}
                />
              </div>
            </div>

            <div className='xl:text-lg -mb-3 flex flex-col xl:flex-row justify-between xl:items-center font-medium'>
              <h2 className='font-display uppercase text-gray-800 font-semibold'>
                Breakdown by Model Year
              </h2>
              <p className='xl:text-right text-xs text-gray-600'>
                *As of 31 January, {selectedDataset}.
              </p>
            </div>
            <div
                className='flex justify-center items-center w-full border-2 border-violet-700 bg-slate-100 rounded-sm '>
              <LineChart
                  xAxis={[{scaleType: 'band', data: resultsByYear.map(a => a.name)}]}
                  sx={{'&&': {touchAction: 'auto'}}}
                  series={[
                    {
                      data: resultsByYear.map(a => a.value), color: '#6D28D9'
                    },
                  ]}
                  width={width < 600 ? (width * 0.8) : 672}
                  height={400}
              />
            </div>

            <div className='xl:text-lg -mb-3 flex flex-col xl:flex-row justify-between xl:items-center font-medium'>
              <h3 className='font-display uppercase text-gray-800 font-semibold'>
                Change in Registered Vehicles
              </h3>
              <p className='xl:text-right text-xs text-gray-600'>
                *As of 31 January, 2024.
              </p>
            </div>
            <div
                className='flex justify-center items-center w-full border-2 border-violet-700 bg-slate-100 rounded-sm '>
              <LineChart
                  xAxis={[{scaleType: 'band', data: resultsChangeByDataset.map(a => a.name)}]}
                  sx={{'&&': {touchAction: 'auto'}}}
                  series={[
                    {
                      data: resultsChangeByDataset.map(a => a.value), color: '#6D28D9'
                    },
                  ]}
                  width={width < 600 ? (width * 0.8) : 672}
                  height={200}
              />
            </div>
          </div>

          <div className='w-full'>
            <h4 className='xl:text-lg font-display uppercase text-gray-800 font-semibold mb-2'>
              Sources
            </h4>
            <div className='flex flex-col gap-1 w-full items-start text-sm text-blue-600 hover:text-blue-700'>
              <a href='https://data.gov.au/dataset/ds-dga-292a071b-71f0-48c4-8617-c2ee0ca1ff2e/details?q='
                 target='_blank'
                 id='rd2021'>
                1. Road vehicles Australia, January 2021
              </a>
              <a href='https://data.gov.au/dataset/ds-dga-c34b68b7-b482-48c4-86ad-a426e22dd761/details?q='
                 target='_blank'
                 id='rd2022'>
                2. Road vehicles Australia, January 2022
              </a>
              <a href='https://data.gov.au/dataset/ds-dga-787053f6-97e1-4170-8e41-32a57277489a/details?q='
                 target='_blank'
                 id='rd2023'>
                3. Road vehicles Australia, January 2023
              </a>
              <a href='https://data.gov.au/dataset/ds-dga-767b84b8-6756-460a-96c9-9c073153485a/details?q='
                 target='_blank'
                 id='rd2024'>
                4. Road vehicles Australia, January 2024
              </a>
            </div>
          </div>
        </div>
      </>
  )
}