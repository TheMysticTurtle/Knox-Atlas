//! `streets.xml` — named street polylines and widths (absolute world coordinates).

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::Reader;

use crate::error::{CoreError, Result};
use crate::types::{Bounds, Point, Street};
use crate::util::{attribute, parse_f32};

pub(crate) fn parse_streets(path: &Path, bounds: &mut Bounds) -> Result<Vec<Street>> {
    let file = File::open(path).map_err(|error| CoreError::io("the street data", error))?;
    let mut reader = Reader::from_reader(BufReader::new(file));
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut current: Option<Street> = None;
    let mut streets = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) if element.name().as_ref() == b"street" => {
                current = Some(Street {
                    name: attribute(&element, b"name").unwrap_or_else(|| "Unnamed road".into()),
                    width: parse_f32(attribute(&element, b"width")),
                    points: Vec::new(),
                });
            }
            Ok(Event::Empty(element)) if element.name().as_ref() == b"point" => {
                if let Some(street) = current.as_mut() {
                    let point = Point {
                        x: parse_f32(attribute(&element, b"x")),
                        y: parse_f32(attribute(&element, b"y")),
                    };
                    bounds.include(point);
                    street.points.push(point);
                }
            }
            Ok(Event::End(element)) if element.name().as_ref() == b"street" => {
                if let Some(street) = current.take() {
                    if street.points.len() > 1 {
                        streets.push(street);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(CoreError::parse("streets.xml", error.to_string())),
            _ => {}
        }
        buffer.clear();
    }

    Ok(streets)
}
