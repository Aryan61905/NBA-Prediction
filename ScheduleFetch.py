
import requests
from bs4 import BeautifulSoup
import time

def dateModifier(date):
    month_dict = {
        "Jan":"01",
        "Feb":"02",
        "Mar":"03",
        "Apr":"04",
        "May":"05",
        "Jun":"06",
        "Oct":"10",
        "Nov":"11",
        "Dec":"12"}
    date = date.split(" ")
    date = date[3]+"-"+month_dict[date[1]]+"-"+(date[2].replace(",","") if len(date[2].replace(",",""))>1 else "0"+date[2].replace(",",""))
    return date

def teamModifier(team):
    team_dict = {
        "GOL":"GSW", 
        "SAN": "SAS", 
        "BRO": "BRK",
        "CHA": "CHO", 
        "CLIPPERS":"LAC", 
        "LAKERS":"LAL", 
        "NEW":"NOP", 
        "PELICANS": "NOP", 
        "KNICKS": "NYK", 
        "OKL": "OKC"
    }

    team_chars = team[0:3].upper()
    if team_chars in ["NEW", "LOS"]: 
        team_chars = team_dict[team.split(" ")[-1].upper()]
    elif team_chars in team_dict:
        team_chars = team_dict[team_chars]
    return team_chars
        

def ScheduleFetch():
    data=[]
    for month in ["october","november","december","january","february","march","april","may","june"]:
        url = f"https://www.basketball-reference.com/leagues/NBA_2025_games-{month}.html"
        response = requests.get(url)
        
        if response.status_code == 200:
            page_content = response.text
            soup = BeautifulSoup(str(page_content), "html.parser")
            tables = soup.find_all("table")

            #print(f"********************************* {month.upper()} **********************************************")
        
            if tables:
                for table in tables:
                    
                    
                    
                    rows = table.find_all("tr")[1:] 
                    for row in rows:
                        
                        row_data = [cell.get_text() for cell in row.find_all(["th", "td"])]
                        if row_data[0]!="Date":
                            row_data[0] = dateModifier(row_data[0])
                            if len(row.find_all('a', href=True))>3:
                                link = row.find_all('a', href=True)[3]
                                row_data[6] = link['href']
                            row_data[2],row_data[4] = teamModifier(row_data[2]),teamModifier(row_data[4])
                            data.append(row_data)
            #print(headers)  
        else:
            print(f"Failed to retrieve the webpage for {month}.")
    
    return data

