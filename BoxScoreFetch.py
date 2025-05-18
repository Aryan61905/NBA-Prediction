
import requests
from bs4 import BeautifulSoup

def BoxScoreFetch(BoxScoreId):
    
    url = f"https://www.basketball-reference.com{BoxScoreId}"
    response = requests.get(url)

    if response.status_code == 200:
        page_content = response.text
        soup = BeautifulSoup(str(page_content), 'html.parser')
        tables = soup.find_all("table")   
        data = {}
        flag = ""
        away = ''
        if tables:
            for table in tables:
                title = table.attrs['id']
                data[title] = []
                rows = table.find_all("tr")[1:]
                home = BoxScoreId[-8:-5]

                for row in rows:
                    row_data = [cell.get_text() for cell in row.find_all(["th", "td"])]
                   
                    if title[title.rindex('-')+1:] == 'basic':
                        if len(row_data)!=22:
                            listofzeros = [0] * (22-len(row_data))
                            row_data+=listofzeros
                            row_data[1]='Did Not Play'
                    else:
                        if len(row_data)!=17:
                            listofzeros = [0] * (17-len(row_data))
                            row_data+=listofzeros
                            row_data[1]='Did Not Play'

                    if row_data[0] == 'Starters':
                        flag = 'S'
                    elif row_data[0] == 'Reserves':
                        flag = 'R'
                    row_data.append(flag)
                    team = title.split("-")[1]
                    if team != home:
                        opp = home
                        away = team
                    else:
                        opp = away

                    gameType = title.split("-")[2]
                    row_data.append(team)
                    row_data.append(opp)
                    row_data.append(gameType)
                    row_data.append(BoxScoreId[-17:-5])
                    if row_data[0] not in ['Starters','Reserves']:
                        data[title].append(row_data)
        return data
    else:
        return response.status_code


